-- =====================================================================
-- Millennium Gym — check-in system schema
-- Run this whole file once in Supabase → SQL Editor.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------

create table if not exists public.settings (
  id               int primary key default 1 check (id = 1),
  guest_fee        numeric(10,2) not null default 80,
  monthly_fee      numeric(10,2) not null default 1000,
  membership_days  int not null default 30,
  gcash_name       text not null default '',
  gcash_number     text not null default '',
  updated_at       timestamptz not null default now()
);
insert into public.settings (id) values (1) on conflict (id) do nothing;

create table if not exists public.profiles (
  id          uuid primary key references auth.users on delete cascade,
  full_name   text not null,
  email       text not null,
  role        text not null default 'member' check (role in ('member', 'admin')),
  -- pending  = registered, waiting for first payment approval
  -- active   = approved (members are "expired" when expires_at < now())
  -- rejected = first payment was rejected (member can resubmit)
  -- disabled = blocked by an admin
  status      text not null default 'pending' check (status in ('pending', 'active', 'rejected', 'disabled')),
  expires_at  timestamptz,
  created_at  timestamptz not null default now()
);

create table if not exists public.checkins (
  id           uuid primary key default gen_random_uuid(),
  kind         text not null check (kind in ('member', 'guest')),
  user_id      uuid references public.profiles (id) on delete set null,
  guest_name   text,
  guest_phone  text,
  status       text not null default 'approved' check (status in ('pending', 'approved', 'rejected')),
  access_code  uuid not null default gen_random_uuid(),  -- lets an anonymous guest poll their own visit
  created_at   timestamptz not null default now()
);
create index if not exists checkins_created_idx on public.checkins (created_at desc);
create index if not exists checkins_user_idx on public.checkins (user_id, created_at desc);

create table if not exists public.payments (
  id            uuid primary key default gen_random_uuid(),
  kind          text not null check (kind in ('membership', 'renewal', 'guest')),
  user_id       uuid references public.profiles (id) on delete cascade,
  checkin_id    uuid references public.checkins (id) on delete cascade,
  method        text not null check (method in ('gcash', 'counter')),
  amount        numeric(10,2) not null,
  receipt_path  text,
  status        text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  note          text,
  reviewed_by   uuid references public.profiles (id) on delete set null,
  reviewed_at   timestamptz,
  created_at    timestamptz not null default now()
);
create index if not exists payments_status_idx on public.payments (status, created_at);
create index if not exists payments_user_idx on public.payments (user_id, created_at desc);
create index if not exists payments_checkin_idx on public.payments (checkin_id);

create table if not exists public.activity_logs (
  id          bigint generated always as identity primary key,
  actor_id    uuid references public.profiles (id) on delete set null,
  actor_name  text,
  action      text not null,
  details     text,
  created_at  timestamptz not null default now()
);
create index if not exists activity_logs_created_idx on public.activity_logs (created_at desc);

-- Rotating QR tokens shown on the front-desk kiosk.
create table if not exists public.kiosk_tokens (
  token       text primary key,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin' and status = 'active');
$$;

create or replace function public.peso(n numeric)
returns text language sql immutable as $$
  select '₱' || trim(trailing '.' from to_char(n, 'FM999,999,990.99'));
$$;

create or replace function public.log_activity(
  p_action text, p_details text, p_actor uuid default auth.uid(), p_actor_name text default null
) returns void language plpgsql security definer set search_path = public as $$
begin
  insert into activity_logs (actor_id, actor_name, action, details)
  values (
    p_actor,
    coalesce(p_actor_name, (select full_name from profiles where id = p_actor), 'System'),
    p_action,
    p_details
  );
end $$;

-- A QR token is valid for 10 minutes after the kiosk shows it (the kiosk rotates every 60s).
create or replace function public.kiosk_token_valid(p_token text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from kiosk_tokens where token = p_token and created_at > now() - interval '10 minutes');
$$;

-- ---------------------------------------------------------------------
-- New auth user → profile (+ pending membership payment for self sign-ups)
-- ---------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  meta      jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_method  text  := case when meta->>'payment_method' = 'gcash' then 'gcash' else 'counter' end;
  v_receipt text  := meta->>'receipt_path';
  v_fee     numeric;
begin
  insert into profiles (id, full_name, email)
  values (new.id, coalesce(nullif(trim(meta->>'full_name'), ''), split_part(new.email, '@', 1)), new.email);

  -- Accounts created by an admin (edge function) are finalised there.
  if coalesce((new.raw_app_meta_data->>'via_admin')::boolean, false) then
    return new;
  end if;

  if v_receipt is null or v_receipt not like 'uploads/%' then
    v_method := 'counter';
    v_receipt := null;
  end if;

  select monthly_fee into v_fee from settings where id = 1;
  insert into payments (kind, user_id, method, amount, receipt_path)
  values ('membership', new.id, v_method, v_fee, v_receipt);

  perform log_activity('member.registered',
    case when v_method = 'gcash' then 'Online sign-up · GCash' else 'Online sign-up · Pay over the counter' end,
    new.id);
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- Kiosk
-- ---------------------------------------------------------------------

create or replace function public.kiosk_rotate()
returns text language plpgsql security definer set search_path = public as $$
declare v_token text := replace(gen_random_uuid()::text, '-', '');
begin
  if not is_admin() then raise exception 'Not authorized'; end if;
  delete from kiosk_tokens where created_at < now() - interval '1 day';
  insert into kiosk_tokens (token) values (v_token);
  return v_token;
end $$;

-- ---------------------------------------------------------------------
-- Member check-in
-- ---------------------------------------------------------------------

create or replace function public.member_check_in(p_token text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  p      profiles;
  v_last checkins;
begin
  if auth.uid() is null then
    return jsonb_build_object('result', 'not_logged_in');
  end if;
  if not kiosk_token_valid(p_token) then
    return jsonb_build_object('result', 'invalid_token');
  end if;

  select * into p from profiles where id = auth.uid();
  if not found then return jsonb_build_object('result', 'not_logged_in'); end if;
  if p.role = 'admin' then return jsonb_build_object('result', 'admin', 'full_name', p.full_name); end if;
  if p.status = 'pending' then return jsonb_build_object('result', 'pending', 'full_name', p.full_name); end if;
  if p.status in ('rejected', 'disabled') then
    return jsonb_build_object('result', p.status, 'full_name', p.full_name);
  end if;

  if p.expires_at is null or p.expires_at <= now() then
    return jsonb_build_object(
      'result', 'expired',
      'full_name', p.full_name,
      'expires_at', p.expires_at,
      'renewal_pending', exists (select 1 from payments where user_id = p.id and status = 'pending')
    );
  end if;

  -- Don't double-log someone who scans twice in the same session.
  select * into v_last from checkins
   where user_id = p.id and created_at > now() - interval '3 hours'
   order by created_at desc limit 1;
  if found then
    return jsonb_build_object('result', 'already', 'full_name', p.full_name,
      'expires_at', p.expires_at, 'checked_in_at', v_last.created_at);
  end if;

  insert into checkins (kind, user_id, status) values ('member', p.id, 'approved') returning * into v_last;
  return jsonb_build_object('result', 'ok', 'full_name', p.full_name,
    'expires_at', p.expires_at, 'checked_in_at', v_last.created_at);
end $$;

-- ---------------------------------------------------------------------
-- Guest check-in (anonymous)
-- ---------------------------------------------------------------------

create or replace function public.guest_check_in(
  p_token text, p_name text, p_phone text, p_method text, p_receipt_path text
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_fee  numeric;
  v_name text := trim(coalesce(p_name, ''));
  c      checkins;
begin
  if not kiosk_token_valid(p_token) then
    raise exception 'This QR code has expired. Please scan the code on the front desk screen again.';
  end if;
  if length(v_name) < 2 or length(v_name) > 80 then raise exception 'Please enter your full name.'; end if;
  if p_method not in ('gcash', 'counter') then raise exception 'Invalid payment method.'; end if;
  if p_method = 'gcash' and coalesce(p_receipt_path, '') not like 'uploads/%' then
    raise exception 'Please upload your GCash receipt.';
  end if;

  select guest_fee into v_fee from settings where id = 1;

  insert into checkins (kind, guest_name, guest_phone, status)
  values ('guest', v_name, nullif(left(trim(coalesce(p_phone, '')), 20), ''), 'pending')
  returning * into c;

  insert into payments (kind, checkin_id, method, amount, receipt_path)
  values ('guest', c.id, p_method, v_fee, case when p_method = 'gcash' then p_receipt_path end);

  perform log_activity('guest.checkin',
    case when p_method = 'gcash' then 'GCash' else 'Pay over the counter' end || ' · ' || peso(v_fee),
    null, v_name);

  return jsonb_build_object('id', c.id, 'code', c.access_code);
end $$;

create or replace function public.guest_visit_status(p_id uuid, p_code uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'status', c.status, 'guest_name', c.guest_name, 'created_at', c.created_at,
    'method', p.method, 'amount', p.amount, 'note', p.note)
  from checkins c
  left join payments p on p.checkin_id = c.id
  where c.id = p_id and c.access_code = p_code and c.kind = 'guest';
$$;

-- ---------------------------------------------------------------------
-- Member payments (renewal, or resubmitting a rejected registration)
-- ---------------------------------------------------------------------

create or replace function public.submit_payment(p_method text, p_receipt_path text)
returns void language plpgsql security definer set search_path = public as $$
declare
  p      profiles;
  v_fee  numeric;
  v_kind text;
begin
  select * into p from profiles where id = auth.uid();
  if not found or p.role <> 'member' then raise exception 'Only members can submit payments.'; end if;
  if p.status = 'disabled' then raise exception 'Your account is disabled. Please see the front desk.'; end if;
  if exists (select 1 from payments where user_id = p.id and status = 'pending') then
    raise exception 'You already have a payment waiting for verification.';
  end if;
  if p_method not in ('gcash', 'counter') then raise exception 'Invalid payment method.'; end if;
  if p_method = 'gcash' and coalesce(p_receipt_path, '') not like 'uploads/%' then
    raise exception 'Please upload your GCash receipt.';
  end if;

  v_kind := case when p.status = 'active' then 'renewal' else 'membership' end;
  if p.status = 'rejected' then
    update profiles set status = 'pending' where id = p.id;
  end if;

  select monthly_fee into v_fee from settings where id = 1;
  insert into payments (kind, user_id, method, amount, receipt_path)
  values (v_kind, p.id, p_method, v_fee, case when p_method = 'gcash' then p_receipt_path end);

  perform log_activity('payment.submitted',
    initcap(v_kind) || ' · ' || case when p_method = 'gcash' then 'GCash' else 'Over the counter' end || ' · ' || peso(v_fee));
end $$;

-- ---------------------------------------------------------------------
-- Admin actions
-- ---------------------------------------------------------------------

create or replace function public.admin_review_payment(p_id uuid, p_approve boolean, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  pay     payments;
  v_days  int;
  v_name  text;
  v_until timestamptz;
  v_how   text;
begin
  if not is_admin() then raise exception 'Not authorized'; end if;

  select * into pay from payments where id = p_id for update;
  if not found then raise exception 'Payment not found.'; end if;
  if pay.status <> 'pending' then raise exception 'This payment was already reviewed.'; end if;

  update payments
     set status = case when p_approve then 'approved' else 'rejected' end,
         note = nullif(trim(coalesce(p_note, '')), ''),
         reviewed_by = auth.uid(),
         reviewed_at = now()
   where id = p_id;

  v_how := case when pay.method = 'gcash' then 'GCash' else 'Counter' end || ' · ' || peso(pay.amount);

  if pay.kind = 'guest' then
    update checkins set status = case when p_approve then 'approved' else 'rejected' end
     where id = pay.checkin_id returning guest_name into v_name;
    perform log_activity(case when p_approve then 'guest.approved' else 'guest.rejected' end,
      coalesce(v_name, 'Guest') || ' · ' || v_how);
    return;
  end if;

  select membership_days into v_days from settings where id = 1;

  if p_approve then
    update profiles
       set status = 'active',
           expires_at = greatest(coalesce(expires_at, now()), now()) + make_interval(days => v_days)
     where id = pay.user_id
     returning full_name, expires_at into v_name, v_until;
    v_how := v_how || ' · until ' || to_char(v_until at time zone 'Asia/Manila', 'Mon DD, YYYY');
  else
    update profiles set status = case when status = 'pending' then 'rejected' else status end
     where id = pay.user_id returning full_name into v_name;
  end if;

  perform log_activity(
    case when pay.kind = 'renewal' then 'renewal.' else 'membership.' end
      || case when p_approve then 'approved' else 'rejected' end,
    coalesce(v_name, 'Member') || ' · ' || v_how);
end $$;

create or replace function public.admin_counter_renewal(p_user_id uuid)
returns timestamptz language plpgsql security definer set search_path = public as $$
declare
  p     profiles;
  s     settings;
  v_new timestamptz;
begin
  if not is_admin() then raise exception 'Not authorized'; end if;
  select * into p from profiles where id = p_user_id and role = 'member' for update;
  if not found then raise exception 'Member not found.'; end if;
  if p.status = 'disabled' then raise exception 'This account is disabled. Enable it first.'; end if;

  select * into s from settings where id = 1;
  v_new := greatest(coalesce(p.expires_at, now()), now()) + make_interval(days => s.membership_days);

  update profiles set status = 'active', expires_at = v_new where id = p.id;
  insert into payments (kind, user_id, method, amount, status, reviewed_by, reviewed_at)
  values (case when p.status = 'active' then 'renewal' else 'membership' end,
          p.id, 'counter', s.monthly_fee, 'approved', auth.uid(), now());

  perform log_activity('renewal.counter',
    p.full_name || ' · ' || peso(s.monthly_fee) || ' · until ' || to_char(v_new at time zone 'Asia/Manila', 'Mon DD, YYYY'));
  return v_new;
end $$;

create or replace function public.admin_set_disabled(p_user_id uuid, p_disabled boolean)
returns void language plpgsql security definer set search_path = public as $$
declare v_name text; v_role text;
begin
  if not is_admin() then raise exception 'Not authorized'; end if;
  if p_user_id = auth.uid() then raise exception 'You cannot disable your own account.'; end if;

  update profiles
     set status = case
           when p_disabled then 'disabled'
           when role = 'member' and expires_at is null then 'pending'
           else 'active' end
   where id = p_user_id
   returning full_name, role into v_name, v_role;
  if not found then raise exception 'Account not found.'; end if;

  perform log_activity(case when p_disabled then 'account.disabled' else 'account.enabled' end,
    v_name || ' (' || v_role || ')');
end $$;

create or replace function public.admin_update_settings(
  p_guest_fee numeric, p_monthly_fee numeric, p_membership_days int, p_gcash_name text, p_gcash_number text
) returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Not authorized'; end if;
  if p_guest_fee < 0 or p_monthly_fee < 0 or p_membership_days < 1 then raise exception 'Invalid values.'; end if;
  update settings
     set guest_fee = p_guest_fee, monthly_fee = p_monthly_fee, membership_days = p_membership_days,
         gcash_name = trim(coalesce(p_gcash_name, '')), gcash_number = trim(coalesce(p_gcash_number, '')),
         updated_at = now()
   where id = 1;
  perform log_activity('settings.updated',
    'Guest ' || peso(p_guest_fee) || ' · Monthly ' || peso(p_monthly_fee) || ' / ' || p_membership_days || ' days');
end $$;

create or replace function public.admin_dashboard()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_start timestamptz := date_trunc('day', now() at time zone 'Asia/Manila') at time zone 'Asia/Manila';
begin
  if not is_admin() then raise exception 'Not authorized'; end if;
  return jsonb_build_object(
    'members_today', (select count(*) from checkins where kind = 'member' and created_at >= v_start),
    'guests_today',  (select count(*) from checkins where kind = 'guest' and status <> 'rejected' and created_at >= v_start),
    'guest_sales_today', (select coalesce(sum(amount), 0) from payments
                           where kind = 'guest' and status = 'approved' and reviewed_at >= v_start),
    'membership_sales_today', (select coalesce(sum(amount), 0) from payments
                           where kind in ('membership', 'renewal') and status = 'approved' and reviewed_at >= v_start),
    'active_members', (select count(*) from profiles where role = 'member' and status = 'active' and expires_at > now()),
    'expiring_soon',  (select count(*) from profiles where role = 'member' and status = 'active'
                        and expires_at > now() and expires_at <= now() + interval '7 days'),
    'pending', (select count(*) from payments where status = 'pending')
  );
end $$;

-- Only admin sign-ins are worth auditing; member sign-ins would just be noise.
create or replace function public.log_sign_in()
returns void language plpgsql security definer set search_path = public as $$
begin
  if is_admin() then perform log_activity('auth.sign_in', 'Admin signed in'); end if;
end $$;

-- ---------------------------------------------------------------------
-- Function privileges
-- ---------------------------------------------------------------------

revoke execute on function public.log_activity(text, text, uuid, text) from public, anon, authenticated;
grant  execute on function public.log_activity(text, text, uuid, text) to service_role;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Row level security (all writes go through the functions above)
-- ---------------------------------------------------------------------

alter table public.settings      enable row level security;
alter table public.profiles      enable row level security;
alter table public.checkins      enable row level security;
alter table public.payments      enable row level security;
alter table public.activity_logs enable row level security;
alter table public.kiosk_tokens  enable row level security;

drop policy if exists "settings readable by everyone" on public.settings;
create policy "settings readable by everyone" on public.settings
  for select to anon, authenticated using (true);

drop policy if exists "profiles: own or admin" on public.profiles;
create policy "profiles: own or admin" on public.profiles
  for select to authenticated using (id = auth.uid() or public.is_admin());

drop policy if exists "checkins: own or admin" on public.checkins;
create policy "checkins: own or admin" on public.checkins
  for select to authenticated using (user_id = auth.uid() or public.is_admin());

drop policy if exists "payments: own or admin" on public.payments;
create policy "payments: own or admin" on public.payments
  for select to authenticated using (user_id = auth.uid() or public.is_admin());

drop policy if exists "activity: admin" on public.activity_logs;
create policy "activity: admin" on public.activity_logs
  for select to authenticated using (public.is_admin());

-- ---------------------------------------------------------------------
-- Storage: receipts bucket (private). Anyone may upload into uploads/,
-- only admins can view.
-- ---------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('receipts', 'receipts', false, 5242880,
        array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])
on conflict (id) do nothing;

drop policy if exists "receipts: upload" on storage.objects;
create policy "receipts: upload" on storage.objects
  for insert to anon, authenticated
  with check (bucket_id = 'receipts' and (storage.foldername(name))[1] = 'uploads');

drop policy if exists "receipts: admin read" on storage.objects;
create policy "receipts: admin read" on storage.objects
  for select to authenticated
  using (bucket_id = 'receipts' and public.is_admin());

-- ---------------------------------------------------------------------
-- Realtime (live dashboard, approvals queue, kiosk feed)
-- ---------------------------------------------------------------------

do $$
begin
  begin alter publication supabase_realtime add table public.checkins; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.payments; exception when duplicate_object then null; end;
end $$;
