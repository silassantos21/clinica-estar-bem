import { FastifyPluginAsync } from 'fastify'
import { requireAdmin, requireAuth } from '../middlewares/guards.js'
import { sendWhatsApp, msgCredenciais } from '../services/notifications.js'

const professionalsRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /professionals — lista todos com dados do usuário vinculado
  fastify.get('/professionals', { preHandler: requireAdmin }, async (_request, reply) => {
    const { data, error } = await fastify.supabase
      .from('professionals')
      .select('id, created_at, users(id, name, email, phone, active)')
    if (error) return reply.status(500).send({ error: error.message })
    return reply.send(data)
  })

  // POST /professionals — cria conta no Supabase Auth + tabelas users + professionals
  fastify.post<{
    Body: {
      name: string
      email: string
      password: string
      phone?: string
    }
  }>('/professionals', { preHandler: requireAdmin }, async (request, reply) => {
    const { name, email, password, phone } = request.body

    // 1. Cria no Supabase Auth (requer service_role)
    const { data: authData, error: authError } = await fastify.supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })
    if (authError) return reply.status(400).send({ error: authError.message })

    const userId = authData.user.id

    // 2. Insere em public.users
    const { error: userError } = await fastify.supabase
      .from('users')
      .insert({ id: userId, name, email, phone: phone ?? null, role: 'professional' })

    if (userError) {
      await fastify.supabase.auth.admin.deleteUser(userId)
      return reply.status(400).send({ error: userError.message })
    }

    // 3. Insere em public.professionals
    const { data, error: profError } = await fastify.supabase
      .from('professionals')
      .insert({ user_id: userId })
      .select('id, created_at, users(id, name, email, phone, active)')
      .single()

    if (profError) {
      await fastify.supabase.auth.admin.deleteUser(userId)
      return reply.status(400).send({ error: profError.message })
    }

    // Envia credenciais via WhatsApp — fire-and-forget
    if (phone) {
      sendWhatsApp(phone, msgCredenciais(name, email, password))
    }

    return reply.status(201).send(data)
  })

  // PUT /professionals/:id — atualiza dados do profissional e do usuário vinculado
  fastify.put<{
    Params: { id: string }
    Body: {
      name?: string
      phone?: string | null
      active?: boolean
    }
  }>('/professionals/:id', { preHandler: requireAdmin }, async (request, reply) => {
    const { id } = request.params
    const { name, phone, active } = request.body

    const { data: profRow } = await fastify.supabase
      .from('professionals')
      .select('user_id')
      .eq('id', id)
      .single()

    if (!profRow) return reply.status(404).send({ error: 'Profissional não encontrado' })

    const userUpdates: Record<string, unknown> = {}
    if (name !== undefined) userUpdates.name = name
    if (phone !== undefined) userUpdates.phone = phone
    if (active !== undefined) userUpdates.active = active

    if (Object.keys(userUpdates).length > 0) {
      const { error } = await fastify.supabase
        .from('users')
        .update(userUpdates)
        .eq('id', profRow.user_id)
      if (error) return reply.status(400).send({ error: error.message })
    }

    const { data, error } = await fastify.supabase
      .from('professionals')
      .select('id, created_at, users(id, name, email, phone, active)')
      .eq('id', id)
      .single()

    if (error) return reply.status(400).send({ error: error.message })
    return reply.send(data)
  })

  // DELETE /professionals/:id — desativa o profissional (soft delete)
  fastify.delete<{ Params: { id: string } }>(
    '/professionals/:id',
    { preHandler: requireAdmin },
    async (request, reply) => {
      const { id } = request.params

      const { data: profRow } = await fastify.supabase
        .from('professionals')
        .select('user_id')
        .eq('id', id)
        .single()

      if (!profRow) return reply.status(404).send({ error: 'Profissional não encontrado' })

      const { error } = await fastify.supabase
        .from('users')
        .update({ active: false })
        .eq('id', profRow.user_id)

      if (error) return reply.status(400).send({ error: error.message })
      return reply.status(204).send()
    },
  )

  // GET /professionals/me/reservations — reservas futuras do profissional autenticado
  fastify.get(
    '/professionals/me/reservations',
    { preHandler: requireAuth },
    async (request, reply) => {
      const { authUser } = request
      if (authUser.role !== 'professional' || !authUser.professionalId) {
        return reply.status(403).send({ error: 'Acesso restrito ao profissional' })
      }

      const now = new Date().toISOString().split('T')[0]

      const { data, error } = await fastify.supabase
        .from('reservations')
        .select('*, rooms(name, number)')
        .eq('professional_id', authUser.professionalId)
        .eq('status', 'confirmed')
        .gte('start_at', now)
        .order('start_at', { ascending: true })
        .limit(5)

      if (error) return reply.status(500).send({ error: error.message })
      return reply.send(data)
    },
  )
}

export default professionalsRoutes
