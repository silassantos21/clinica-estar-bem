import 'dotenv/config'
import { buildApp } from './app.js'
import { registerCronJobs } from './cron/reminders.js'
import { initWhatsApp } from './services/whatsapp.js'

const PORT = Number(process.env.PORT ?? 3001)
const HOST = process.env.HOST ?? '0.0.0.0'

async function start() {
  const app = await buildApp()

  try {
    await app.listen({ port: PORT, host: HOST })
    app.log.info(`API rodando em http://${HOST}:${PORT}`)
    registerCronJobs(app.supabase)
    initWhatsApp().catch((e) => console.error('[WhatsApp] Falha ao inicializar:', e))
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }
}

start()
