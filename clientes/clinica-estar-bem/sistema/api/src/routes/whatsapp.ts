import { FastifyPluginAsync } from 'fastify'
import { requireAdmin } from '../middlewares/guards.js'
import { getWAStatus, requestPairingCode } from '../services/whatsapp.js'

const whatsappRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/whatsapp/status', { preHandler: requireAdmin }, async () => {
    return getWAStatus()
  })

  fastify.post<{ Body: { phone: string } }>(
    '/whatsapp/pair',
    { preHandler: requireAdmin },
    async (request, reply) => {
      const { phone } = request.body
      if (!phone) return reply.status(400).send({ error: 'Número obrigatório' })
      try {
        const code = await requestPairingCode(phone)
        return reply.send({ code })
      } catch (e) {
        return reply.status(400).send({ error: (e as Error).message })
      }
    },
  )
}

export default whatsappRoutes
