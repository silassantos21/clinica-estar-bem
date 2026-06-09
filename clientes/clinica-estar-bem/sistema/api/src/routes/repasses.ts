import { FastifyPluginAsync } from 'fastify'
import { requireAuth, requireAdmin } from '../middlewares/guards.js'

const repassesRoutes: FastifyPluginAsync = async (fastify) => {

  // POST /reservations/:id/complete (admin)
  // Marca sessão como completed e cria repasse com valor integral
  fastify.post<{ Params: { id: string } }>(
    '/reservations/:id/complete',
    { preHandler: requireAdmin },
    async (request, reply) => {
      const { id } = request.params

      const { data: reservation, error } = await fastify.supabase
        .from('reservations')
        .select('id, status, total_amount, psychologist_id')
        .eq('id', id)
        .single()

      if (error || !reservation) return reply.status(404).send({ error: 'Reserva não encontrada' })

      if (reservation.status !== 'confirmed') {
        return reply.status(409).send({ error: `Reserva não pode ser concluída: status atual é ${reservation.status}` })
      }

      // Idempotência: não criar repasse duplicado
      const { data: existingRepasse } = await fastify.supabase
        .from('repasses')
        .select('id')
        .eq('reservation_id', id)
        .maybeSingle()

      await fastify.supabase
        .from('reservations')
        .update({ status: 'completed' })
        .eq('id', id)

      if (!existingRepasse) {
        await fastify.supabase.from('repasses').insert({
          reservation_id: id,
          psychologist_id: reservation.psychologist_id,
          amount: Number(reservation.total_amount),
          status: 'pending',
        })
      }

      return reply.send({ completed: true })
    },
  )

  // GET /repasses — admin vê todos; psicólogo vê só os próprios
  fastify.get<{
    Querystring: { status?: string; psychologist_id?: string; start?: string; end?: string }
  }>('/repasses', { preHandler: requireAuth }, async (request, reply) => {
    const { authUser } = request
    const { status, psychologist_id, start, end } = request.query

    let query = fastify.supabase
      .from('repasses')
      .select('*, psychologists(users(name)), reservations(start_at, total_amount, rooms(name), patients(name))')
      .order('created_at', { ascending: false })

    if (authUser.role === 'psychologist') {
      if (!authUser.psychologistId) return reply.status(400).send({ error: 'Perfil de psicólogo não encontrado' })
      query = query.eq('psychologist_id', authUser.psychologistId)
    } else if (psychologist_id) {
      query = query.eq('psychologist_id', psychologist_id)
    }

    if (status) query = query.eq('status', status)
    if (start) query = query.gte('created_at', start)
    if (end) query = query.lte('created_at', end)

    const { data, error } = await query
    if (error) return reply.status(500).send({ error: error.message })
    return reply.send(data)
  })

  // PUT /repasses/:id/pay (admin)
  fastify.put<{
    Params: { id: string }
    Body: { notes?: string }
  }>('/repasses/:id/pay', { preHandler: requireAdmin }, async (request, reply) => {
    const { id } = request.params
    const { notes } = request.body ?? {}

    const { data: repasse, error } = await fastify.supabase
      .from('repasses')
      .select('id, status')
      .eq('id', id)
      .single()

    if (error || !repasse) return reply.status(404).send({ error: 'Repasse não encontrado' })
    if (repasse.status === 'paid') return reply.status(409).send({ error: 'Repasse já está pago' })

    const { data: updated, error: updErr } = await fastify.supabase
      .from('repasses')
      .update({
        status: 'paid',
        paid_at: new Date().toISOString(),
        paid_by: request.authUser.id,
        notes: notes ?? null,
      })
      .eq('id', id)
      .select('*')
      .single()

    if (updErr) return reply.status(500).send({ error: updErr.message })
    return reply.send(updated)
  })

  // GET /reports/financial?month=MM&year=YYYY (admin)
  fastify.get<{
    Querystring: { month?: string; year?: string }
  }>('/reports/financial', { preHandler: requireAdmin }, async (request, reply) => {
    const now = new Date()
    const month = parseInt(request.query.month ?? String(now.getMonth() + 1), 10)
    const year = parseInt(request.query.year ?? String(now.getFullYear()), 10)

    const start = `${year}-${String(month).padStart(2, '0')}-01T00:00:00`
    const endDate = new Date(year, month, 1)
    const end = endDate.toISOString().replace('T', 'T').split('T')[0] + 'T00:00:00'

    // Pagamentos do período (via data da reserva)
    const { data: payments } = await fastify.supabase
      .from('payments')
      .select('amount, status, reservations!inner(start_at)')
      .gte('reservations.start_at', start)
      .lt('reservations.start_at', end)

    const totalPaid = (payments ?? [])
      .filter((p) => p.status === 'paid' || p.status === 'retained')
      .reduce((s, p) => s + Number(p.amount), 0)

    const totalRetained = (payments ?? [])
      .filter((p) => p.status === 'retained')
      .reduce((s, p) => s + Number(p.amount), 0)

    const totalRefunded = (payments ?? [])
      .filter((p) => p.status === 'refunded')
      .reduce((s, p) => s + Number(p.amount), 0)

    // Repasses do período
    const { data: repasses } = await fastify.supabase
      .from('repasses')
      .select('amount, status, reservations!inner(start_at)')
      .gte('reservations.start_at', start)
      .lt('reservations.start_at', end)

    const repassesPagos = (repasses ?? [])
      .filter((r) => r.status === 'paid')
      .reduce((s, r) => s + Number(r.amount), 0)

    const repassesPendentes = (repasses ?? [])
      .filter((r) => r.status === 'pending')
      .reduce((s, r) => s + Number(r.amount), 0)

    const countRepassesPendentes = (repasses ?? []).filter((r) => r.status === 'pending').length

    return reply.send({
      month,
      year,
      receita_bruta: parseFloat(totalPaid.toFixed(2)),
      total_retido: parseFloat(totalRetained.toFixed(2)),
      total_reembolsado: parseFloat(totalRefunded.toFixed(2)),
      repasses_pagos: parseFloat(repassesPagos.toFixed(2)),
      repasses_pendentes: parseFloat(repassesPendentes.toFixed(2)),
      count_repasses_pendentes: countRepassesPendentes,
    })
  })

  // GET /reports/rooms?start=YYYY-MM-DD&end=YYYY-MM-DD (admin)
  fastify.get<{
    Querystring: { start?: string; end?: string }
  }>('/reports/rooms', { preHandler: requireAdmin }, async (request, reply) => {
    const now = new Date()
    const defaultStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)
    const defaultEnd = nextMonth.toISOString().split('T')[0]

    const start = request.query.start ?? defaultStart
    const end = request.query.end ?? defaultEnd

    const [{ data: rooms }, { data: reservations }] = await Promise.all([
      fastify.supabase.from('rooms').select('id, name').eq('active', true),
      fastify.supabase
        .from('reservations')
        .select('room_id, start_at')
        .gte('start_at', `${start}T00:00:00`)
        .lt('start_at', `${end}T00:00:00`)
        .not('status', 'in', '("cancelled")'),
    ])

    // Calcular dias no período
    const startDate = new Date(start)
    const endDate = new Date(end)
    const days = Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)))
    const availablePerRoom = days * 15 // 07:00–22:00 = 15 slots de 1h

    const result = (rooms ?? []).map((room) => {
      const used = (reservations ?? []).filter((r) => r.room_id === room.id).length
      return {
        room_id: room.id,
        room_name: room.name,
        available_hours: availablePerRoom,
        used_hours: used,
        occupancy_rate: parseFloat(((used / availablePerRoom) * 100).toFixed(1)),
      }
    })

    return reply.send({ start, end, rooms: result })
  })

  // GET /reports/psychologists?start=YYYY-MM-DD&end=YYYY-MM-DD (admin)
  fastify.get<{
    Querystring: { start?: string; end?: string }
  }>('/reports/psychologists', { preHandler: requireAdmin }, async (request, reply) => {
    const now = new Date()
    const defaultStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)
    const defaultEnd = nextMonth.toISOString().split('T')[0]

    const start = request.query.start ?? defaultStart
    const end = request.query.end ?? defaultEnd

    const [{ data: psychologists }, { data: reservations }, { data: repasses }] = await Promise.all([
      fastify.supabase.from('psychologists').select('id, users(name)'),
      fastify.supabase
        .from('reservations')
        .select('id, psychologist_id, status, total_amount')
        .gte('start_at', `${start}T00:00:00`)
        .lt('start_at', `${end}T00:00:00`),
      fastify.supabase
        .from('repasses')
        .select('psychologist_id, amount, status, reservations!inner(start_at)')
        .gte('reservations.start_at', `${start}T00:00:00`)
        .lt('reservations.start_at', `${end}T00:00:00`),
    ])

    const result = (psychologists ?? []).map((psych) => {
      const myRes = (reservations ?? []).filter((r) => r.psychologist_id === psych.id)
      const myRepasses = (repasses ?? []).filter((r) => r.psychologist_id === psych.id)

      return {
        psychologist_id: psych.id,
        name: (psych.users as any)?.name ?? '—',
        total_reservations: myRes.length,
        completed: myRes.filter((r) => r.status === 'completed').length,
        cancelled: myRes.filter((r) => r.status === 'cancelled').length,
        no_shows: myRes.filter((r) => r.status === 'no_show').length,
        receita: parseFloat(
          myRes
            .filter((r) => r.status === 'completed' || r.status === 'confirmed')
            .reduce((s, r) => s + Number(r.total_amount), 0)
            .toFixed(2),
        ),
        repasses_pendentes: parseFloat(
          myRepasses.filter((r) => r.status === 'pending').reduce((s, r) => s + Number(r.amount), 0).toFixed(2),
        ),
        repasses_pagos: parseFloat(
          myRepasses.filter((r) => r.status === 'paid').reduce((s, r) => s + Number(r.amount), 0).toFixed(2),
        ),
      }
    })

    return reply.send({ start, end, psychologists: result })
  })
}

export default repassesRoutes
