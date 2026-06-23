import { FastifyPluginAsync } from 'fastify'
import { requireAuth } from '../middlewares/guards.js'
import { sendWhatsApp, msgConfirmacao } from '../services/notifications.js'

const reservationsRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /rooms/availability?date=YYYY-MM-DD&room_id=uuid
  // Retorna blocos de 1h disponíveis das 07:00 às 21:00
  // Considera reservas confirmadas E bloqueios do admin
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

      const [{ data: reservations, error: resErr }, { data: blocks }] = await Promise.all([
        fastify.supabase
          .from('reservations')
          .select('start_at')
          .eq('room_id', room_id)
          .gte('start_at', `${date}T00:00:00`)
          .lt('start_at', `${nextDayStr}T00:00:00`)
          .eq('status', 'confirmed'),
        fastify.supabase
          .from('room_blocks')
          .select('hour')
          .eq('room_id', room_id)
          .eq('date', date),
      ])

      if (resErr) return reply.status(500).send({ error: resErr.message })

      const reservedHours = new Set(
        (reservations ?? []).map((r) => parseInt(r.start_at.substring(11, 13), 10)),
      )
      const blockedHours = new Set((blocks ?? []).map((b) => b.hour))

      const slots = []
      for (let hour = 7; hour <= 21; hour++) {
        const hStr = String(hour).padStart(2, '0')
        const hNextStr = String(hour + 1).padStart(2, '0')
        slots.push({
          hour,
          start_at: `${date}T${hStr}:00:00`,
          end_at: `${date}T${hNextStr}:00:00`,
          available: !reservedHours.has(hour) && !blockedHours.has(hour),
          blocked: blockedHours.has(hour),
        })
      }

      return reply.send(slots)
    },
  )

  // GET /reservations — admin vê todas; profissional vê só as próprias
  fastify.get<{
    Querystring: { date?: string; status?: string; room_id?: string; professional_id?: string }
  }>('/reservations', { preHandler: requireAuth }, async (request, reply) => {
    const { authUser } = request
    const { date, status, room_id, professional_id } = request.query

    let query = fastify.supabase
      .from('reservations')
      .select('*, professionals(users(name, email)), rooms(name, number)')
      .order('start_at', { ascending: false })

    if (authUser.role === 'professional') {
      if (!authUser.professionalId) return reply.status(400).send({ error: 'Perfil de profissional não encontrado' })
      query = query.eq('professional_id', authUser.professionalId)
    } else if (professional_id) {
      query = query.eq('professional_id', professional_id)
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
        .select('*, professionals(users(name, email)), rooms(name, number)')
        .eq('id', id)
        .single()

      if (error || !data) return reply.status(404).send({ error: 'Reserva não encontrada' })

      if (authUser.role === 'professional' && data.professional_id !== authUser.professionalId) {
        return reply.status(403).send({ error: 'Sem permissão para ver esta reserva' })
      }

      return reply.send(data)
    },
  )

  // POST /reservations — cria reserva com validação de conflito e bloqueios
  fastify.post<{
    Body: {
      room_id: string
      start_at: string // "YYYY-MM-DDTHH:00:00"
      professional_id?: string // apenas para admin
    }
  }>('/reservations', { preHandler: requireAuth }, async (request, reply) => {
    const { authUser } = request
    const { room_id, start_at, professional_id: profIdBody } = request.body

    // Determinar professional_id conforme role
    let professionalId: string
    if (authUser.role === 'professional') {
      if (!authUser.professionalId) return reply.status(400).send({ error: 'Perfil de profissional não encontrado' })
      professionalId = authUser.professionalId
    } else if (authUser.role === 'admin' && profIdBody) {
      professionalId = profIdBody
    } else {
      return reply.status(400).send({ error: 'professional_id é obrigatório para admin' })
    }

    // Validar formato de start_at
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:00:00$/.test(start_at)) {
      return reply.status(400).send({ error: 'start_at inválido — esperado YYYY-MM-DDTHH:00:00' })
    }

    // end_at = start_at + 1h (sem conversão de timezone)
    const startHour = parseInt(start_at.substring(11, 13), 10)
    const end_at = `${start_at.substring(0, 11)}${String(startHour + 1).padStart(2, '0')}:00:00`

    // Data e hora extraída para verificar bloqueio
    const date = start_at.substring(0, 10)

    // Verificar conflito de reserva e bloqueio em paralelo
    const [{ data: conflict }, { data: block }] = await Promise.all([
      fastify.supabase
        .from('reservations')
        .select('id')
        .eq('room_id', room_id)
        .lt('start_at', end_at)
        .gt('end_at', start_at)
        .eq('status', 'confirmed')
        .maybeSingle(),
      fastify.supabase
        .from('room_blocks')
        .select('id')
        .eq('room_id', room_id)
        .eq('date', date)
        .eq('hour', startHour)
        .maybeSingle(),
    ])

    if (conflict) {
      return reply.status(409).send({ error: 'Horário já ocupado para esta sala' })
    }
    if (block) {
      return reply.status(409).send({ error: 'Este horário está bloqueado pelo administrador' })
    }

    const { data, error } = await fastify.supabase
      .from('reservations')
      .insert({
        professional_id: professionalId,
        room_id,
        start_at,
        end_at,
        status: 'confirmed',
      })
      .select('*, professionals(users(name, phone)), rooms(name, number)')
      .single()

    if (error) return reply.status(400).send({ error: error.message })

    // Notificação WhatsApp — fire-and-forget
    const profUser = (data as any)?.professionals?.users
    sendWhatsApp(
      profUser?.phone,
      msgConfirmacao(profUser?.name ?? 'Profissional', data.rooms?.name ?? 'Sala', start_at),
    )

    return reply.status(201).send(data)
  })
}

export default reservationsRoutes
