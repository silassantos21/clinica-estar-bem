import { FastifyPluginAsync } from 'fastify'
import { requireAdmin, requireAuth } from '../middlewares/guards.js'

const roomsRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /rooms — lista todas as salas
  fastify.get('/rooms', { preHandler: requireAuth }, async (_request, reply) => {
    const { data, error } = await fastify.supabase
      .from('rooms')
      .select('*')
      .order('number')
    if (error) return reply.status(500).send({ error: error.message })
    return reply.send(data)
  })

  // PUT /rooms/:id — admin atualiza nome ou ativa/desativa sala
  fastify.put<{
    Params: { id: string }
    Body: { name?: string; active?: boolean }
  }>('/rooms/:id', { preHandler: requireAdmin }, async (request, reply) => {
    const { id } = request.params
    const updates: Record<string, unknown> = {}
    const { name, active } = request.body
    if (name !== undefined) updates.name = name
    if (active !== undefined) updates.active = active

    const { data, error } = await fastify.supabase
      .from('rooms')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    if (error) return reply.status(400).send({ error: error.message })
    if (!data) return reply.status(404).send({ error: 'Sala não encontrada' })
    return reply.send(data)
  })

  // POST /rooms/:id/blocks — admin bloqueia horário específico de uma sala
  fastify.post<{
    Params: { id: string }
    Body: { date: string; hour: number; reason?: string }
  }>('/rooms/:id/blocks', { preHandler: requireAdmin }, async (request, reply) => {
    const { id: room_id } = request.params
    const { date, hour, reason } = request.body

    if (!date || hour === undefined) {
      return reply.status(400).send({ error: 'date e hour são obrigatórios' })
    }
    if (hour < 7 || hour > 21) {
      return reply.status(400).send({ error: 'hour deve ser entre 7 e 21' })
    }

    const { data, error } = await fastify.supabase
      .from('room_blocks')
      .insert({
        room_id,
        date,
        hour,
        blocked_by: request.authUser.id,
        reason: reason ?? null,
      })
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        return reply.status(409).send({ error: 'Este horário já está bloqueado' })
      }
      return reply.status(400).send({ error: error.message })
    }

    return reply.status(201).send(data)
  })

  // DELETE /rooms/:id/blocks/:block_id — admin desbloqueia horário
  fastify.delete<{ Params: { id: string; block_id: string } }>(
    '/rooms/:id/blocks/:block_id',
    { preHandler: requireAdmin },
    async (request, reply) => {
      const { block_id } = request.params

      const { error } = await fastify.supabase
        .from('room_blocks')
        .delete()
        .eq('id', block_id)

      if (error) return reply.status(400).send({ error: error.message })
      return reply.status(204).send()
    },
  )

  // GET /rooms/:id/blocks?date=YYYY-MM-DD — lista bloqueios de uma sala numa data
  fastify.get<{
    Params: { id: string }
    Querystring: { date?: string }
  }>('/rooms/:id/blocks', { preHandler: requireAdmin }, async (request, reply) => {
    const { id: room_id } = request.params
    const { date } = request.query

    let query = fastify.supabase
      .from('room_blocks')
      .select('*, users(name)')
      .eq('room_id', room_id)
      .order('date')
      .order('hour')

    if (date) query = query.eq('date', date)

    const { data, error } = await query
    if (error) return reply.status(500).send({ error: error.message })
    return reply.send(data)
  })
}

export default roomsRoutes
