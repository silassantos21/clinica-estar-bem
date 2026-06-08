import { FastifyPluginAsync } from 'fastify'
import { requireAdmin, requireAuth } from '../middlewares/guards.js'

const psychologistsRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /psychologists — lista todos com dados do usuário
  fastify.get('/psychologists', { preHandler: requireAdmin }, async (_request, reply) => {
    const { data, error } = await fastify.supabase
      .from('psychologists')
      .select('id, crp, penalty_split_rate, users(id, name, email, phone, active)')
    if (error) return reply.status(500).send({ error: error.message })
    return reply.send(data)
  })

  // POST /psychologists — cria usuário no auth + tabelas users + psychologists
  fastify.post<{
    Body: {
      name: string
      email: string
      password: string
      phone?: string
      crp?: string
      penalty_split_rate?: number
    }
  }>('/psychologists', { preHandler: requireAdmin }, async (request, reply) => {
    const { name, email, password, phone, crp, penalty_split_rate = 0.5 } = request.body

    // 1. Cria no Supabase Auth (exige service_role)
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
      .insert({ id: userId, name, email, phone: phone ?? null, role: 'psychologist' })

    if (userError) {
      await fastify.supabase.auth.admin.deleteUser(userId)
      return reply.status(400).send({ error: userError.message })
    }

    // 3. Insere em public.psychologists
    const { data, error: psychError } = await fastify.supabase
      .from('psychologists')
      .insert({ user_id: userId, crp: crp ?? null, penalty_split_rate })
      .select('id, crp, penalty_split_rate, users(id, name, email, phone, active)')
      .single()

    if (psychError) {
      await fastify.supabase.auth.admin.deleteUser(userId)
      return reply.status(400).send({ error: psychError.message })
    }

    return reply.status(201).send(data)
  })

  // PUT /psychologists/:id — atualiza dados do psicólogo e do usuário vinculado
  fastify.put<{
    Params: { id: string }
    Body: {
      name?: string
      phone?: string | null
      crp?: string | null
      penalty_split_rate?: number
      active?: boolean
    }
  }>('/psychologists/:id', { preHandler: requireAdmin }, async (request, reply) => {
    const { id } = request.params
    const { name, phone, crp, penalty_split_rate, active } = request.body

    // Localiza user_id do psicólogo
    const { data: psychRow } = await fastify.supabase
      .from('psychologists')
      .select('user_id')
      .eq('id', id)
      .single()

    if (!psychRow) return reply.status(404).send({ error: 'Psicólogo não encontrado' })

    // Atualiza public.users (só campos fornecidos)
    const userUpdates: Record<string, unknown> = {}
    if (name !== undefined) userUpdates.name = name
    if (phone !== undefined) userUpdates.phone = phone
    if (active !== undefined) userUpdates.active = active

    if (Object.keys(userUpdates).length > 0) {
      const { error } = await fastify.supabase
        .from('users')
        .update(userUpdates)
        .eq('id', psychRow.user_id)
      if (error) return reply.status(400).send({ error: error.message })
    }

    // Atualiza public.psychologists (só se houver campos)
    const psychUpdates: Record<string, unknown> = {}
    if (crp !== undefined) psychUpdates.crp = crp
    if (penalty_split_rate !== undefined) psychUpdates.penalty_split_rate = penalty_split_rate

    if (Object.keys(psychUpdates).length > 0) {
      const { error: psychError } = await fastify.supabase
        .from('psychologists')
        .update(psychUpdates)
        .eq('id', id)
      if (psychError) return reply.status(400).send({ error: psychError.message })
    }

    const { data, error } = await fastify.supabase
      .from('psychologists')
      .select('id, crp, penalty_split_rate, users(id, name, email, phone, active)')
      .eq('id', id)
      .single()

    if (error) return reply.status(400).send({ error: error.message })
    return reply.send(data)
  })

  // GET /psychologists/:id/rooms — salas ativas com tarifa efetiva para este psicólogo
  // Admin acessa qualquer; psicólogo só acessa as próprias
  fastify.get<{ Params: { id: string } }>(
    '/psychologists/:id/rooms',
    { preHandler: requireAuth },
    async (request, reply) => {
      const { id } = request.params
      const { authUser } = request

      if (authUser.role !== 'admin' && authUser.psychologistId !== id) {
        return reply.status(403).send({ error: 'Sem permissão para acessar este recurso' })
      }

      const [{ data: rooms }, { data: customRates }] = await Promise.all([
        fastify.supabase.from('rooms').select('id, name, floor, hourly_rate, active').eq('active', true).order('name'),
        fastify.supabase.from('psychologist_rooms').select('room_id, custom_rate').eq('psychologist_id', id),
      ])

      const rateMap = new Map((customRates ?? []).map((r) => [r.room_id, r.custom_rate]))

      const result = (rooms ?? []).map((room) => ({
        ...room,
        custom_rate: rateMap.get(room.id) ?? null,
        effective_rate: rateMap.get(room.id) ?? room.hourly_rate,
      }))

      return reply.send(result)
    },
  )

  // PUT /psychologists/:id/rooms/:room_id — define ou remove tarifa customizada
  fastify.put<{
    Params: { id: string; room_id: string }
    Body: { custom_rate: number | null }
  }>(
    '/psychologists/:id/rooms/:room_id',
    { preHandler: requireAdmin },
    async (request, reply) => {
      const { id: psychologist_id, room_id } = request.params
      const { custom_rate } = request.body

      if (custom_rate === null) {
        // Remove tarifa customizada — volta ao padrão da sala
        await fastify.supabase
          .from('psychologist_rooms')
          .delete()
          .eq('psychologist_id', psychologist_id)
          .eq('room_id', room_id)
        return reply.status(204).send()
      }

      const { data, error } = await fastify.supabase
        .from('psychologist_rooms')
        .upsert({ psychologist_id, room_id, custom_rate }, { onConflict: 'psychologist_id,room_id' })
        .select()
        .single()

      if (error) return reply.status(400).send({ error: error.message })
      return reply.send(data)
    },
  )
}

export default psychologistsRoutes
