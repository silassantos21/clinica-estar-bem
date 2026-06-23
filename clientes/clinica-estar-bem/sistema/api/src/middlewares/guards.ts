import { FastifyReply, FastifyRequest } from 'fastify'

export async function requireAdmin(request: FastifyRequest, reply: FastifyReply) {
  if (request.authUser?.role !== 'admin') {
    return reply.status(403).send({ error: 'Acesso restrito ao administrador' })
  }
}

export async function requireProfessional(request: FastifyRequest, reply: FastifyReply) {
  if (request.authUser?.role !== 'professional') {
    return reply.status(403).send({ error: 'Acesso restrito ao profissional' })
  }
}

export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  if (!request.authUser) {
    return reply.status(401).send({ error: 'Não autenticado' })
  }
}
