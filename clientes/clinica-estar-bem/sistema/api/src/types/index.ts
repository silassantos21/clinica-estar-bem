export type UserRole = 'admin' | 'psychologist'

export interface AuthUser {
  id: string
  email: string
  role: UserRole
  name: string
  active: boolean
  psychologistId?: string // preenchido quando role = psychologist
}

// Augmenta o FastifyRequest para incluir o usuário autenticado
declare module 'fastify' {
  interface FastifyRequest {
    authUser: AuthUser
  }
}
