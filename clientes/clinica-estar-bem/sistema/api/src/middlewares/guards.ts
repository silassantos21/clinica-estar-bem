import { FastifyReply, FastifyRequest } from 'fastify'

export async function requireAdmin(request: FastifyRequest, reply: FastifyReply) {
  if (request.authUser?.role !== 'admin') {
    return reply.status(403).send({ error: 'Acesso restrito ao administrador' })
  }
}

export async function requirePsychologist(request: FastifyRequest, reply: FastifyReply) {
  if (request.authUser?.role !== 'psychologist') {
    return reply.status(403).send({ error: 'Acesso restrito ao psicólogo' })
  }
}

export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  if (!request.authUser) {
    return reply.status(401).send({ error: 'Não autenticado' })
  }
}
