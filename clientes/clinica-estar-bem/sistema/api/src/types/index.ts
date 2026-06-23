export type UserRole = 'admin' | 'professional'

export interface AuthUser {
  id: string
  email: string
  role: UserRole
  name: string
  active: boolean
  professionalId?: string // preenchido quando role = professional
}

// Augmenta o FastifyRequest para incluir o usuário autenticado
declare module 'fastify' {
  interface FastifyRequest {
    authUser: AuthUser
  }
}
