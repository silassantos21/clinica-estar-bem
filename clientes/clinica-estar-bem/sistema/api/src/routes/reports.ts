import { FastifyPluginAsync } from 'fastify'
import { requireAdmin } from '../middlewares/guards.js'

const reportsRoutes: FastifyPluginAsync = async (fastify) => {
  async function buildReport(start: string, end: string) {
    const { data, error } = await fastify.supabase
      .from('reservations')
      .select('status, professional_id, professionals(id, users(name)), rooms(name)')
      .gte('start_at', `${start}T00:00:00`)
      .lt('start_at', `${end}T00:00:00`)

    if (error) throw new Error(error.message)

    const map = new Map<string, {
      professional_id: string
      name: string
      reservations_count: number
      cancellations_count: number
      rooms_used: string[]
    }>()

    for (const r of (data ?? []) as any[]) {
      const profId: string = r.professional_id
      const profName: string = r.professionals?.users?.name ?? 'Desconhecido'
      const roomName: string | undefined = r.rooms?.name

      if (!map.has(profId)) {
        map.set(profId, {
          professional_id: profId,
          name: profName,
          reservations_count: 0,
          cancellations_count: 0,
          rooms_used: [],
        })
      }

      const row = map.get(profId)!
      if (r.status === 'confirmed') {
        row.reservations_count++
        if (roomName && !row.rooms_used.includes(roomName)) row.rooms_used.push(roomName)
      } else if (r.status === 'cancelled') {
        row.cancellations_count++
      }
    }

    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
  }

  // GET /reports/weekly?start=YYYY-MM-DD
  fastify.get<{ Querystring: { start: string } }>(
    '/reports/weekly',
    { preHandler: requireAdmin },
    async (request, reply) => {
      const { start } = request.query
      if (!start || !/^\d{4}-\d{2}-\d{2}$/.test(start)) {
        return reply.status(400).send({ error: 'start (YYYY-MM-DD) é obrigatório' })
      }
      const d = new Date(`${start}T12:00:00`)
      d.setDate(d.getDate() + 7)
      const end = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      try {
        const rows = await buildReport(start, end)
        return reply.send({ start, end, rows })
      } catch (e) {
        return reply.status(500).send({ error: (e as Error).message })
      }
    },
  )

  // GET /reports/monthly?month=M&year=YYYY
  fastify.get<{ Querystring: { month: string; year: string } }>(
    '/reports/monthly',
    { preHandler: requireAdmin },
    async (request, reply) => {
      const { month, year } = request.query
      const m = parseInt(month ?? '', 10)
      const y = parseInt(year ?? '', 10)
      if (!m || !y || m < 1 || m > 12) {
        return reply.status(400).send({ error: 'month (1-12) e year são obrigatórios' })
      }
      const start = `${y}-${String(m).padStart(2, '0')}-01`
      const nextM = m === 12 ? 1 : m + 1
      const nextY = m === 12 ? y + 1 : y
      const end = `${nextY}-${String(nextM).padStart(2, '0')}-01`
      try {
        const rows = await buildReport(start, end)
        return reply.send({ start, end, rows })
      } catch (e) {
        return reply.status(500).send({ error: (e as Error).message })
      }
    },
  )
}

export default reportsRoutes
