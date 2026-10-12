export const KIND_LABEL = { membership: 'New member', renewal: 'Renewal', guest: 'Guest' }

export const payerName = (p) => (p.kind === 'guest' ? p.visit?.guest_name : p.member?.full_name) ?? 'Unknown'
