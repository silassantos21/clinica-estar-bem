import fp from 'fastify-plugin'
import { FastifyPluginAsync } from 'fastify'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import ws from 'ws'

declare module 'fastify' {
  interface FastifyInstance {
    supabase: SupabaseClient
  }
}

const supabasePlugin: FastifyPluginAsync = async (fastify) => {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error('SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios')
  }

  // service_role bypassa RLS — autorização feita nos middlewares da API
  // ws necessário: Node 20 não tem WebSocket nativo, exigido pelo @supabase/realtime-js
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = createClient(url, key, {
    auth: { persistSession: false },
    realtime: { transport: ws as any },
  })

  fastify.decorate('supabase', client)
}

export default fp(supabasePlugin, { name: 'supabase' })
