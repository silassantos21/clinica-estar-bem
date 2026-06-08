import { FastifyPluginAsync } from 'fastify'
import { requireAuth } from '../middlewares/guards.js'

const authRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /auth/login — rota pública; listada em publicPaths no plugin auth
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
}

export default authRoutes
