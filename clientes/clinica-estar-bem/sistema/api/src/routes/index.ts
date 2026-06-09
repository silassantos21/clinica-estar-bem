import { FastifyPluginAsync } from 'fastify'
import healthRoute from './health.js'
import authRoutes from './auth.js'
import roomsRoutes from './rooms.js'
import psychologistsRoutes from './psychologists.js'
import settingsRoutes from './settings.js'
import patientsRoutes from './patients.js'
import reservationsRoutes from './reservations.js'
import paymentsRoutes from './payments.js'
import cancellationsRoutes from './cancellations.js'
import repassesRoutes from './repasses.js'

const routes: FastifyPluginAsync = async (fastify) => {
  await fastify.register(healthRoute)

  // Sprint 1
  await fastify.register(authRoutes)
  await fastify.register(roomsRoutes)
  await fastify.register(psychologistsRoutes)
  await fastify.register(settingsRoutes)

  // Sprint 2
  await fastify.register(patientsRoutes)
  await fastify.register(reservationsRoutes)

  // Sprint 3
  await fastify.register(paymentsRoutes)

  // Sprint 4
  await fastify.register(cancellationsRoutes)

  // Sprint 5
  await fastify.register(repassesRoutes)
}

export default routes
