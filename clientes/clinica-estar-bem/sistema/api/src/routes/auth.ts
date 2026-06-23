import { FastifyPluginAsync } from 'fastify'
import { requireAuth } from '../middlewares/guards.js'

const authRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /auth/login — rota pública
  fastify.post<{ Body: { email: string; password: string } }>('/auth/login', async (request, reply) => {
    const { email, password } = request.body

    const { data, error } = await fastify.supabase.auth.signInWithPassword({ email, password })
    if (error || !data.session) {
      return reply.status(401).send({ error: 'Credenciais inválidas' })
    }

    return reply.send({ access_token: data.session.access_token })
  })

  // POST /auth/logout
  fastify.post('/auth/logout', async (_request, reply) => {
    await fastify.supabase.auth.signOut()
    return reply.status(204).send()
  })

  // GET /me — perfil do usuário autenticado
  fastify.get('/me', { preHandler: requireAuth }, async (request, reply) => {
    return reply.send(request.authUser)
  })

  // PUT /auth/change-password — troca a senha do usuário autenticado
  fastify.put<{ Body: { password: string } }>(
    '/auth/change-password',
    { preHandler: requireAuth },
    async (request, reply) => {
      const { password } = request.body

      if (!password || password.length < 6) {
        return reply.status(400).send({ error: 'A nova senha deve ter pelo menos 6 caracteres' })
      }

      const { error } = await fastify.supabase.auth.admin.updateUserById(
        request.authUser.id,
        { password },
      )

      if (error) return reply.status(400).send({ error: error.message })
      return reply.send({ updated: true })
    },
  )
}

export default authRoutes
