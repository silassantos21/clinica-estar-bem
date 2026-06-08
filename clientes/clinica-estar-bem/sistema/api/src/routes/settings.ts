import { FastifyPluginAsync } from 'fastify'
import { requireAdmin } from '../middlewares/guards.js'

const settingsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/settings', { preHandler: requireAdmin }, async (_request, reply) => {
    const { data, error } = await fastify.supabase
      .from('settings')
      .select('*')
      .order('key')
    if (error) return reply.status(500).send({ error: error.message })
    return reply.send(data)
  })

  fastify.put<{ Params: { key: string }; Body: { value: string } }>(
    '/settings/:key',
    { preHandler: requireAdmin },
    async (request, reply) => {
      const { key } = request.params
      const { value } = request.body

      const { data, error } = await fastify.supabase
        .from('settings')
        .update({ value, updated_at: new Date().toISOString() })
        .eq('key', key)
        .select()
        .single()
      if (error) return reply.status(400).send({ error: error.message })
      if (!data) return reply.status(404).send({ error: 'Configuração não encontrada' })
      return reply.send(data)
    },
  )
}

export default settingsRoutes
