import fp from 'fastify-plugin'
import { FastifyPluginAsync } from 'fastify'
import { AuthUser } from '../types/index.js'

const authPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.decorateRequest('authUser', null)

  fastify.addHook('onRequest', async (request, reply) => {
    const publicPaths = ['/health', '/auth/login']
    if (publicPaths.some((p) => request.url.startsWith(p))) return

    const authHeader = request.headers.authorization
    if (!authHeader?.startsWith('Bearer ')) {
      return reply.status(401).send({ error: 'Token não fornecido' })
    }

    const token = authHeader.slice(7)

    const { data, error } = await fastify.supabase.auth.getUser(token)
    if (error || !data.user) {
      return reply.status(401).send({ error: 'Token inválido ou expirado' })
    }

    const { data: userRow, error: userError } = await fastify.supabase
      .from('users')
      .select('id, name, email, role, active')
      .eq('id', data.user.id)
      .single()

    if (userError || !userRow) {
      return reply.status(401).send({ error: 'Perfil de usuário não encontrado' })
    }

    if (!userRow.active) {
      return reply.status(403).send({ error: 'Usuário inativo' })
    }

    // Busca ID do profissional em query separada (evita problema com join reverse-FK)
    let professionalId: string | undefined
    if (userRow.role === 'professional') {
      const { data: profRow } = await fastify.supabase
        .from('professionals')
        .select('id')
        .eq('user_id', userRow.id)
        .maybeSingle()
      professionalId = profRow?.id
    }

    request.authUser = {
      id: userRow.id,
      email: userRow.email,
      role: userRow.role as AuthUser['role'],
      name: userRow.name,
      active: userRow.active,
      professionalId,
    }
  })
}

export default fp(authPlugin, { name: 'auth', dependencies: ['supabase'] })
