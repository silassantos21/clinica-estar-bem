import { FastifyInstance, FastifyPluginAsync } from 'fastify'
import { requireAuth } from '../middlewares/guards.js'

async function getRate(fastify: FastifyInstance, psychologistId: string, roomId: string): Promise<number> {
  const { data: override } = await fastify.supabase
    .from('psychologist_rooms')
    .select('custom_rate')
    .eq('psychologist_id', psychologistId)
    .eq('room_id', roomId)
    .maybeSingle()

  if (override?.custom_rate !== null && override?.custom_rate !== undefined) {
    return Number(override.custom_rate)
  }

  const { data: room } = await fastify.supabase
    .from('rooms')
    .select('hourly_rate')
    .eq('id', roomId)
    .single()

  return Number(room?.hourly_rate ?? 0)
}

const reservationsRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /rooms/availability?date=YYYY-MM-DD&room_id=uuid
  // Retorna blocos de 1h disponíveis das 07:00 às 21:00
  fastify.get<{ Querystring: { date: string; room_id: string } }>(
    '/rooms/availability',
    { preHandler: requireAuth },
    async (request, reply) => {
      const { date, room_id } = request.query

      if (!date || !room_id) {
        return reply.status(400).send({ error: 'date e room_id são obrigatórios' })
      }

      const nextDay = new Date(date)
      nextDay.setDate(nextDay.getDate() + 1)
      const nextDayStr = nextDay.toISOString().split('T')[0]

      const { data: reservations, error } = await fastify.supabase
        .from('reservations')
        .select('start_at')
        .eq('room_id', room_id)
        .gte('start_at', `${date}T00:00:00`)
        .lt('start_at', `${nextDayStr}T00:00:00`)
        .neq('status', 'cancelled')

      if (error) return reply.status(500).send({ error: error.message })

      // Horas ocupadas: extrair hora local do start_at
      const occupiedHours = new Set(
        (reservations ?? []).map((r) => {
          // start_at formato: "2026-06-10T09:00:00" ou com timezone
          const hourStr = r.start_at.substring(11, 13)
          return parseInt(hourStr, 10)
        }),
      )

      const slots = []
      for (let hour = 7; hour < 22; hour++) {
        const hStr = String(hour).padStart(2, '0')
        const hNextStr = String(hour + 1).padStart(2, '0')
        slots.push({
          hour,
          start_at: `${date}T${hStr}:00:00`,
          end_at: `${date}T${hNextStr}:00:00`,
          available: !occupiedHours.has(hour),
        })
      }

      return reply.send(slots)
    },
  )

  // GET /reservations — admin vê todas; psicólogo vê só as próprias
  fastify.get<{
    Querystring: { date?: string; status?: string; room_id?: string; psychologist_id?: string }
  }>('/reservations', { preHandler: requireAuth }, async (request, reply) => {
    const { authUser } = request
    const { date, status, room_id, psychologist_id } = request.query

    let query = fastify.supabase
      .from('reservations')
      .select('*, psychologists(users(name, email)), rooms(name), patients(name, phone), payments(id, status, payment_link_url)')
      .order('start_at', { ascending: false })

    if (authUser.role === 'psychologist') {
      if (!authUser.psychologistId) return reply.status(400).send({ error: 'Perfil de psicólogo não encontrado' })
      query = query.eq('psychologist_id', authUser.psychologistId)
    } else if (psychologist_id) {
      query = query.eq('psychologist_id', psychologist_id)
    }

    if (date) {
      const nextDay = new Date(date)
      nextDay.setDate(nextDay.getDate() + 1)
      const nextDayStr = nextDay.toISOString().split('T')[0]
      query = query.gte('start_at', `${date}T00:00:00`).lt('start_at', `${nextDayStr}T00:00:00`)
    }

    if (status) query = query.eq('status', status)
    if (room_id) query = query.eq('room_id', room_id)

    const { data, error } = await query
    if (error) return reply.status(500).send({ error: error.message })
    return reply.send(data)
  })

  // GET /reservations/:id
  fastify.get<{ Params: { id: string } }>(
    '/reservations/:id',
    { preHandler: requireAuth },
    async (request, reply) => {
      const { authUser } = request
      const { id } = request.params

      const { data, error } = await fastify.supabase
        .from('reservations')
        .select('*, psychologists(users(name, email)), rooms(name), patients(name, phone, email), payments(id, status, payment_link_url, paid_at)')
        .eq('id', id)
        .single()

      if (error || !data) return reply.status(404).send({ error: 'Reserva não encontrada' })

      if (authUser.role === 'psychologist' && data.psychologist_id !== authUser.psychologistId) {
        return reply.status(403).send({ error: 'Sem permissão para ver esta reserva' })
      }

      return reply.send(data)
    },
  )

  // POST /reservations — cria reserva com cálculo de tarifa e validação de conflito
  fastify.post<{
    Body: {
      room_id: string
      patient_id: string
      start_at: string // "YYYY-MM-DDTHH:00:00"
      psychologist_id?: string // necessário apenas para admin
    }
  }>('/reservations', { preHandler: requireAuth }, async (request, reply) => {
    const { authUser } = request
    const { room_id, patient_id, start_at, psychologist_id: psychIdBody } = request.body

    // Determinar psychologist_id conforme role
    let psychologistId: string
    if (authUser.role === 'psychologist') {
      if (!authUser.psychologistId) return reply.status(400).send({ error: 'Perfil de psicólogo não encontrado' })
      psychologistId = authUser.psychologistId
    } else if (authUser.role === 'admin' && psychIdBody) {
      psychologistId = psychIdBody
    } else {
      return reply.status(400).send({ error: 'psychologist_id é obrigatório para admin' })
    }

    // end_at = start_at + 1h
    // Parsear hora diretamente da string para evitar conversão de timezone
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:00:00$/.test(start_at)) {
      return reply.status(400).send({ error: 'start_at inválido — esperado YYYY-MM-DDTHH:00:00' })
    }
    const startHour = parseInt(start_at.substring(11, 13), 10)
    const end_at = `${start_at.substring(0, 11)}${String(startHour + 1).padStart(2, '0')}:00:00`

    // Verificar conflito de horário (overlap na mesma sala)
    const { data: conflict } = await fastify.supabase
      .from('reservations')
      .select('id')
      .eq('room_id', room_id)
      .lt('start_at', end_at)
      .gt('end_at', start_at)
      .neq('status', 'cancelled')
      .maybeSingle()

    if (conflict) {
      return reply.status(409).send({ error: 'Horário já ocupado para esta sala' })
    }

    // Tarifa efetiva: custom_rate ou hourly_rate padrão da sala
    const total_amount = await getRate(fastify, psychologistId, room_id)

    const { data, error } = await fastify.supabase
      .from('reservations')
      .insert({
        psychologist_id: psychologistId,
        room_id,
        patient_id,
        start_at,
        end_at,
        total_amount,
        status: 'pending',
      })
      .select('*, psychologists(users(name)), rooms(name), patients(name)')
      .single()

    if (error) return reply.status(400).send({ error: error.message })
    return reply.status(201).send(data)
  })
}

export default reservationsRoutes
