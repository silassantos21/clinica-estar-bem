import fp from 'fastify-plugin'
import { FastifyPluginAsync } from 'fastify'
import { AuthUser } from '../types/index.js'

const authPlugin: FastifyPluginAsync = async (fastify) => {
  // Hook global: valida o Bearer token e popula request.authUser
  // Rotas públicas (ex: /health, /webhooks/mercadopago) devem pular via onRequest próprio
  fastify.decorateRequest('authUser', null)

  fastify.addHook('onRequest', async (request, reply) => {
    // Rotas que não precisam de auth
    const publicPaths = ['/health', '/auth/login', '/webhooks/mercadopago']
    if (publicPaths.some((p) => request.url.startsWith(p))) return

    const authHeader = request.headers.authorization
    if (!authHeader?.startsWith('Bearer ')) {
      return reply.status(401).send({ error: 'Token não fornecido' })
    }

    const token = authHeader.slice(7)

    // Valida o token via Supabase Auth
    const { data, error } = await fastify.supabase.auth.getUser(token)
    if (error || !data.user) {
      return reply.status(401).send({ error: 'Token inválido ou expirado' })
    }

    // Busca perfil e role na tabela public.users
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

    // Busca ID do psicólogo em query separada para evitar problemas com join reverse-FK
    let psychologistId: string | undefined
    if (userRow.role === 'psychologist') {
      const { data: psychRow } = await fastify.supabase
        .from('psychologists')
        .select('id')
        .eq('user_id', userRow.id)
        .maybeSingle()
      psychologistId = psychRow?.id
    }

    request.authUser = {
      id: userRow.id,
      email: userRow.email,
      role: userRow.role as AuthUser['role'],
      name: userRow.name,
      active: userRow.active,
      psychologistId,
    }
  })
}

export default fp(authPlugin, { name: 'auth', dependencies: ['supabase'] })
