import Fastify from 'fastify'
import cors from '@fastify/cors'
import sensible from '@fastify/sensible'
import supabasePlugin from './plugins/supabase.js'
import authPlugin from './plugins/auth.js'
import routes from './routes/index.js'

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    },
  })

  await app.register(cors, {
    origin: process.env.FRONTEND_URL ?? 'http://localhost:3000',
    credentials: true,
  })

  await app.register(sensible)
  await app.register(supabasePlugin)
  await app.register(authPlugin)
  await app.register(routes)

  return app
}
