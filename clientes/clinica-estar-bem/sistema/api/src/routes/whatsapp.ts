import { FastifyPluginAsync } from 'fastify'
import { requireAdmin } from '../middlewares/guards.js'
import { getWAStatus } from '../services/whatsapp.js'

const whatsappRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/whatsapp/status', { preHandler: requireAdmin }, async () => {
    return getWAStatus()
  })
}

export default whatsappRoutes
