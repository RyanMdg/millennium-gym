// Creates member or admin accounts on behalf of a signed-in admin.
// Needs the service role key, which is why this can't run in the browser.
import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      auth: { persistSession: false },
    })

    const jwt = (req.headers.get('Authorization') ?? '').replace('Bearer ', '')
    const { data: { user: caller } } = await admin.auth.getUser(jwt)
    if (!caller) return json({ error: 'Not signed in' }, 401)

    const { data: callerProfile } = await admin
      .from('profiles').select('role, status').eq('id', caller.id).single()
    if (callerProfile?.role !== 'admin' || callerProfile?.status !== 'active') {
      return json({ error: 'Not authorized' }, 403)
    }

    const { role, full_name, email, password, payment_method, receipt_path } = await req.json()
    if (!['member', 'admin'].includes(role)) return json({ error: 'Invalid role' }, 400)
    if (!full_name?.trim() || !email?.trim()) return json({ error: 'Name and email are required' }, 400)
    if (!password || password.length < 8) return json({ error: 'Password must be at least 8 characters' }, 400)

    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email: email.trim().toLowerCase(),
      password,
      email_confirm: true,
      user_metadata: { full_name: full_name.trim() },
      app_metadata: { via_admin: true },
    })
    if (createErr) return json({ error: createErr.message }, 400)
    const id = created.user.id

    if (role === 'admin') {
      await admin.from('profiles').update({ role: 'admin', status: 'active' }).eq('id', id)
      await admin.rpc('log_activity', { p_action: 'admin.created', p_details: `${full_name.trim()} · ${email}`, p_actor: caller.id })
      return json({ id })
    }

    // Member registered at the desk: admin has the payment in hand, so activate right away.
    const { data: settings } = await admin.from('settings').select('monthly_fee, membership_days').eq('id', 1).single()
    const expires = new Date(Date.now() + settings!.membership_days * 86_400_000).toISOString()
    const method = payment_method === 'gcash' ? 'gcash' : 'counter'

    await admin.from('profiles').update({ status: 'active', expires_at: expires }).eq('id', id)
    await admin.from('payments').insert({
      kind: 'membership',
      user_id: id,
      method,
      amount: settings!.monthly_fee,
      receipt_path: method === 'gcash' ? receipt_path ?? null : null,
      status: 'approved',
      reviewed_by: caller.id,
      reviewed_at: new Date().toISOString(),
    })
    await admin.rpc('log_activity', {
      p_action: 'member.created',
      p_details: `${full_name.trim()} · ${method === 'gcash' ? 'GCash' : 'Counter'} · ₱${settings!.monthly_fee}`,
      p_actor: caller.id,
    })
    return json({ id })
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Unexpected error' }, 500)
  }
})
