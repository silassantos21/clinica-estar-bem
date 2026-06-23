import { FastifyPluginAsync } from 'fastify'
import healthRoute from './health.js'
import authRoutes from './auth.js'
import roomsRoutes from './rooms.js'
import professionalsRoutes from './professionals.js'
import settingsRoutes from './settings.js'
import reservationsRoutes from './reservations.js'
import cancellationsRoutes from './cancellations.js'
import reportsRoutes from './reports.js'
import whatsappRoutes from './whatsapp.js'

const routes: FastifyPluginAsync = async (fastify) => {
  await fastify.register(healthRoute)
  await fastify.register(authRoutes)
  await fastify.register(roomsRoutes)
  await fastify.register(professionalsRoutes)
  await fastify.register(settingsRoutes)
  await fastify.register(reservationsRoutes)
  await fastify.register(cancellationsRoutes)
  await fastify.register(reportsRoutes)
  await fastify.register(whatsappRoutes)
}

export default routes
