import { FastifyPluginAsync } from 'fastify'
import { requireAdmin } from '../middlewares/guards.js'

const roomsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/rooms', { preHandler: requireAdmin }, async (_request, reply) => {
    const { data, error } = await fastify.supabase
      .from('rooms')
      .select('*')
      .order('name')
    if (error) return reply.status(500).send({ error: error.message })
    return reply.send(data)
  })

  fastify.post<{ Body: { name: string; floor?: string; hourly_rate: number } }>(
    '/rooms',
    { preHandler: requireAdmin },
    async (request, reply) => {
      const { name, floor, hourly_rate } = request.body
      const { data, error } = await fastify.supabase
        .from('rooms')
        .insert({ name, floor: floor ?? null, hourly_rate })
        .select()
        .single()
      if (error) return reply.status(400).send({ error: error.message })
      return reply.status(201).send(data)
    },
  )

  fastify.put<{
    Params: { id: string }
    Body: { name?: string; floor?: string | null; hourly_rate?: number; active?: boolean }
  }>('/rooms/:id', { preHandler: requireAdmin }, async (request, reply) => {
    const { id } = request.params
    const updates: Record<string, unknown> = {}
    const { name, floor, hourly_rate, active } = request.body
    if (name !== undefined) updates.name = name
    if (floor !== undefined) updates.floor = floor
    if (hourly_rate !== undefined) updates.hourly_rate = hourly_rate
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

  // Soft delete — desativa a sala
  fastify.delete<{ Params: { id: string } }>(
    '/rooms/:id',
    { preHandler: requireAdmin },
    async (request, reply) => {
      const { id } = request.params
      const { error } = await fastify.supabase
        .from('rooms')
        .update({ active: false })
        .eq('id', id)
      if (error) return reply.status(400).send({ error: error.message })
      return reply.status(204).send()
    },
  )
}

export default roomsRoutes
