import { createClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !serviceKey) throw new Error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY first.')
if (process.env.NODE_ENV === 'production' && process.env.ALLOW_DEMO_USER_SEED !== '1') {
  throw new Error('Demo-user seeding is disabled in production unless ALLOW_DEMO_USER_SEED=1 is explicitly set.')
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
const password = 'CivicChai!2026'
// The demo staff cover the whole demo area (see migration 007 service_pins).
const demoServicePins = ['401208', '401209', '401210', '401211']
const users = [
  { email: 'citizen@civicchai.local', name: 'Riya Kulkarni', role: 'citizen', pin: '401208' },
  { email: 'moderator@civicchai.local', name: 'Asha Deshmukh', role: 'moderator', pin: '401208' },
  { email: 'operator@civicchai.local', name: 'R. Kulkarni', role: 'department_operator', pin: '401208', department: 'Municipal Public Lighting' },
  { email: 'supervisor@civicchai.local', name: 'S. Mehta', role: 'department_supervisor', pin: '401208', department: 'Municipal Public Lighting' },
  { email: 'authority@civicchai.local', name: 'Ward Authority Admin', role: 'authority_admin', pin: '401208' },
  { email: 'system-admin@civicchai.local', name: 'CivicChai System Admin', role: 'system_admin' },
  { email: 'auditor@civicchai.local', name: 'Independent Auditor', role: 'auditor', pin: '401208' },
]

let knownUsers = []
for (let page = 1; ; page += 1) {
  const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
  if (error) throw error
  knownUsers = knownUsers.concat(data.users)
  if (data.users.length < 1000) break
}

for (const demo of users) {
  let authUser = knownUsers.find((item) => item.email?.toLowerCase() === demo.email)
  const userMetadata = { display_name: demo.name, role: demo.role, is_demo: true }
  if (!authUser) {
    const result = await admin.auth.admin.createUser({ email: demo.email, password, email_confirm: true, user_metadata: userMetadata })
    if (result.error) throw result.error
    authUser = result.data.user
  } else {
    const result = await admin.auth.admin.updateUserById(authUser.id, { password, email_confirm: true, user_metadata: userMetadata })
    if (result.error) throw result.error
    // Shared demo identities must not stay locked to one tester's authenticator app.
    const factors = await admin.auth.admin.mfa.listFactors({ userId: authUser.id })
    if (factors.error) throw factors.error
    for (const factor of factors.data.factors) {
      const removed = await admin.auth.admin.mfa.deleteFactor({ id: factor.id, userId: authUser.id })
      if (removed.error) throw removed.error
    }
    if (factors.data.factors.length) console.log(`Reset ${factors.data.factors.length} MFA factor(s) on ${demo.email}`)
  }

  let jurisdictionId = null
  if (demo.pin) {
    const result = await admin.from('jurisdictions').select('id').eq('pin', demo.pin).limit(1).maybeSingle()
    if (!result.error) jurisdictionId = result.data?.id ?? null
  }
  const profile = {
    id: authUser.id,
    display_name: demo.name,
    role: demo.role,
    pin: demo.pin ?? null,
    department: demo.department ?? null,
    locality: demo.pin ? 'Demo locality' : null,
    jurisdiction_id: jurisdictionId,
    preferred_language: 'en',
    is_demo: true,
  }
  const covers = ['department_operator', 'department_supervisor', 'authority_admin', 'auditor'].includes(demo.role)
  let { error } = await admin.from('profiles').upsert({ ...profile, ...(covers ? { service_pins: demoServicePins } : {}) })
  // Databases without migration 007 have no service_pins column yet.
  if (error && covers && /service_pins/.test(error.message)) ({ error } = await admin.from('profiles').upsert(profile))
  if (error) throw error
  console.log(`Ready: ${demo.role} · ${demo.email}`)
}

console.log(`All demo accounts use ${password}. Remove or rotate them before a public deployment.`)
