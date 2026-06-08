import { readFileSync } from 'fs'
import { resolve } from 'path'

// Lê o .env manualmente
const env = Object.fromEntries(
  readFileSync(resolve(process.cwd(), '.env'), 'utf8')
    .split('\n')
    .filter(l => l && !l.startsWith('#') && l.includes('='))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] })
)

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = env

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌  SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não preenchidos no .env')
  process.exit(1)
}

console.log(`\nTestando conexão com: ${SUPABASE_URL}\n`)

// Testa via REST direto (sem WebSocket / realtime)
async function query(table) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=*&limit=1`, {
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
  })
  return { ok: res.ok, status: res.status, body: await res.json() }
}

const tables = ['settings', 'users', 'rooms', 'psychologists', 'patients', 'reservations', 'payments', 'cancellations', 'repasses']

for (const table of tables) {
  const { ok, status, body } = await query(table)
  if (ok) {
    const extra = table === 'settings' ? ` → ${JSON.stringify(body)}` : ''
    console.log(`✅  ${table}${extra}`)
  } else {
    console.error(`❌  ${table} (HTTP ${status}): ${JSON.stringify(body)}`)
  }
}

console.log('\nTeste concluído.\n')
