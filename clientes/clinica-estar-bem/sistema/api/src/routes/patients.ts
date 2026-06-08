import { FastifyPluginAsync } from 'fastify'
import { requireAuth } from '../middlewares/guards.js'

const patientsRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /patients — psicólogo vê os próprios; admin vê todos
  fastify.get('/patients', { preHandler: requireAuth }, async (request, reply) => {
    const { authUser } = request

    let query = fastify.supabase.from('patients').select('*').order('name')

    if (authUser.role === 'psychologist') {
      if (!authUser.psychologistId) return reply.status(400).send({ error: 'Perfil de psicólogo não encontrado' })
      query = query.eq('psychologist_id', authUser.psychologistId)
    }

    const { data, error } = await query
    if (error) return reply.status(500).send({ error: error.message })
    return reply.send(data)
  })

  // POST /patients — psicólogo cria paciente próprio
  fastify.post<{ Body: { name: string; phone?: string; email?: string } }>(
    '/patients',
    { preHandler: requireAuth },
    async (request, reply) => {
      const { authUser } = request

      if (authUser.role !== 'psychologist') {
        return reply.status(403).send({ error: 'Apenas psicólogos podem criar pacientes' })
      }

      if (!authUser.psychologistId) {
        return reply.status(400).send({ error: 'Perfil de psicólogo não encontrado' })
      }

      const { name, phone, email } = request.body

      const { data, error } = await fastify.supabase
        .from('patients')
        .insert({ psychologist_id: authUser.psychologistId, name, phone: phone ?? null, email: email ?? null })
        .select()
        .single()

      if (error) return reply.status(400).send({ error: error.message })
      return reply.status(201).send(data)
    },
  )

  // PUT /patients/:id — psicólogo edita paciente próprio
  fastify.put<{
    Params: { id: string }
    Body: { name?: string; phone?: string | null; email?: string | null }
  }>('/patients/:id', { preHandler: requireAuth }, async (request, reply) => {
    const { authUser } = request
    const { id } = request.params

    const { data: patient } = await fastify.supabase
      .from('patients')
      .select('psychologist_id')
      .eq('id', id)
      .single()

    if (!patient) return reply.status(404).send({ error: 'Paciente não encontrado' })

    if (authUser.role === 'psychologist' && patient.psychologist_id !== authUser.psychologistId) {
      return reply.status(403).send({ error: 'Sem permissão para editar este paciente' })
    }

    const { name, phone, email } = request.body
    const updates: Record<string, unknown> = {}
    if (name !== undefined) updates.name = name
    if (phone !== undefined) updates.phone = phone
    if (email !== undefined) updates.email = email

    const { data, error } = await fastify.supabase
      .from('patients')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) return reply.status(400).send({ error: error.message })
    return reply.send(data)
  })

  // DELETE /patients/:id — psicólogo deleta paciente próprio
  fastify.delete<{ Params: { id: string } }>(
    '/patients/:id',
    { preHandler: requireAuth },
    async (request, reply) => {
      const { authUser } = request
      const { id } = request.params

      const { data: patient } = await fastify.supabase
        .from('patients')
        .select('psychologist_id')
        .eq('id', id)
        .single()

      if (!patient) return reply.status(404).send({ error: 'Paciente não encontrado' })

      if (authUser.role === 'psychologist' && patient.psychologist_id !== authUser.psychologistId) {
        return reply.status(403).send({ error: 'Sem permissão para excluir este paciente' })
      }

      const { error } = await fastify.supabase.from('patients').delete().eq('id', id)
      if (error) return reply.status(400).send({ error: error.message })
      return reply.status(204).send()
    },
  )
}

export default patientsRoutes
