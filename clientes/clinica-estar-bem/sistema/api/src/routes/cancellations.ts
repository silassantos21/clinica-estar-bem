import { FastifyPluginAsync } from 'fastify'
import { MercadoPagoConfig, PaymentRefund } from 'mercadopago'
import { requireAuth } from '../middlewares/guards.js'

type CancelReason = 'patient_request' | 'psychologist_decision' | 'clinic_decision'

const VALID_REASONS: CancelReason[] = ['patient_request', 'psychologist_decision', 'clinic_decision']

async function getTolerance(fastify: any): Promise<number> {
  const { data } = await fastify.supabase
    .from('settings')
    .select('value')
    .eq('key', 'cancellation_tolerance_hours')
    .single()
  return parseFloat(data?.value ?? '9')
}

function calcPenalty(amount: number, splitRate: number) {
  const psychologistAmount = parseFloat((amount * splitRate).toFixed(2))
  const clinicAmount = parseFloat((amount - psychologistAmount).toFixed(2))
  return { psychologistAmount, clinicAmount }
}

const cancellationsRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /reservations/:id/cancel-preview?reason=...
  // Calcula o impacto financeiro antes de confirmar o cancelamento
  fastify.get<{
    Params: { id: string }
    Querystring: { reason?: string }
  }>('/reservations/:id/cancel-preview', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params
    const reason = (request.query.reason ?? 'patient_request') as CancelReason
    const { authUser } = request

    if (!VALID_REASONS.includes(reason)) {
      return reply.status(400).send({ error: 'reason inválido' })
    }

    const { data: reservation, error } = await fastify.supabase
      .from('reservations')
      .select('id, status, start_at, total_amount, psychologist_id, psychologists(penalty_split_rate)')
      .eq('id', id)
      .single()

    if (error || !reservation) return reply.status(404).send({ error: 'Reserva não encontrada' })

    if (authUser.role === 'psychologist' && reservation.psychologist_id !== authUser.psychologistId) {
      return reply.status(403).send({ error: 'Sem permissão' })
    }

    const { data: payment } = await fastify.supabase
      .from('payments')
      .select('status, amount')
      .eq('reservation_id', id)
      .maybeSingle()

    const hasPaidPayment = payment?.status === 'paid'
    const tolerance = await getTolerance(fastify)
    const now = new Date()
    const startAt = new Date(reservation.start_at)
    const hoursBeforeStart = (startAt.getTime() - now.getTime()) / (1000 * 60 * 60)
    const amount = Number(reservation.total_amount)
    const splitRate = Number(reservation.psychologists?.penalty_split_rate ?? 0.3)

    let penaltyApplied = false
    let refundAmount = 0
    let psychologistAmount = 0
    let clinicAmount = 0

    if (hasPaidPayment) {
      if (reason === 'psychologist_decision' || reason === 'clinic_decision') {
        refundAmount = amount
      } else if (reason === 'patient_request') {
        if (hoursBeforeStart >= tolerance) {
          refundAmount = amount
        } else {
          penaltyApplied = true
          ;({ psychologistAmount, clinicAmount } = calcPenalty(amount, splitRate))
        }
      }
    }

    return reply.send({
      has_paid_payment: hasPaidPayment,
      hours_before_start: Math.max(0, parseFloat(hoursBeforeStart.toFixed(1))),
      tolerance_hours: tolerance,
      penalty_applied: penaltyApplied,
      refund_amount: refundAmount,
      psychologist_amount: psychologistAmount,
      clinic_amount: clinicAmount,
    })
  })

  // POST /reservations/:id/cancel
  // Body: { reason: 'patient_request' | 'psychologist_decision' | 'clinic_decision' }
  // Permissões conforme spec:
  //   patient_request    → admin ✓ | psicólogo (só própria) ✓
  //   psychologist_decision → psicólogo (só própria) ✓ | admin ✗
  //   clinic_decision    → admin ✓ | psicólogo ✗
  fastify.post<{
    Params: { id: string }
    Body: { reason: CancelReason }
  }>('/reservations/:id/cancel', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params
    const { reason } = request.body
    const { authUser } = request

    if (!VALID_REASONS.includes(reason)) {
      return reply.status(400).send({ error: 'reason inválido' })
    }

    const { data: reservation, error: resErr } = await fastify.supabase
      .from('reservations')
      .select('id, status, start_at, total_amount, psychologist_id, psychologists(penalty_split_rate)')
      .eq('id', id)
      .single()

    if (resErr || !reservation) return reply.status(404).send({ error: 'Reserva não encontrada' })

    if (['cancelled', 'completed', 'no_show'].includes(reservation.status)) {
      return reply.status(409).send({ error: `Reserva já está: ${reservation.status}` })
    }

    if (authUser.role === 'psychologist') {
      if (reservation.psychologist_id !== authUser.psychologistId) {
        return reply.status(403).send({ error: 'Sem permissão para cancelar esta reserva' })
      }
      if (reason === 'clinic_decision') {
        return reply.status(403).send({ error: 'Psicólogo não pode usar decisão clínica' })
      }
    } else if (authUser.role === 'admin') {
      if (reason === 'psychologist_decision') {
        return reply.status(403).send({ error: 'Admin não pode usar decisão do psicólogo' })
      }
    }

    const tolerance = await getTolerance(fastify)
    const now = new Date()
    const startAt = new Date(reservation.start_at)
    const hoursBeforeStart = (startAt.getTime() - now.getTime()) / (1000 * 60 * 60)
    const amount = Number(reservation.total_amount)
    const splitRate = Number(reservation.psychologists?.penalty_split_rate ?? 0.3)

    const { data: payment } = await fastify.supabase
      .from('payments')
      .select('id, status, amount, mp_payment_id')
      .eq('reservation_id', id)
      .maybeSingle()

    const hasPaidPayment = payment?.status === 'paid'

    let newPaymentStatus: string | null = payment?.status ?? null
    let penaltyApplied = false
    let clinicAmount = 0
    let psychologistAmount = 0
    let shouldRefundMP = false
    let shouldCreateRepasse = false

    if (hasPaidPayment) {
      if (reason === 'psychologist_decision' || reason === 'clinic_decision') {
        newPaymentStatus = 'refunded'
        if (payment!.mp_payment_id) shouldRefundMP = true
      } else if (reason === 'patient_request') {
        if (hoursBeforeStart >= tolerance) {
          newPaymentStatus = 'refunded'
          if (payment!.mp_payment_id) shouldRefundMP = true
        } else {
          ;({ psychologistAmount, clinicAmount } = calcPenalty(amount, splitRate))
          newPaymentStatus = 'retained'
          penaltyApplied = true
          shouldCreateRepasse = true
        }
      }
    }

    if (payment && newPaymentStatus && newPaymentStatus !== payment.status) {
      const updateData: Record<string, unknown> = { status: newPaymentStatus }
      if (newPaymentStatus === 'refunded') updateData.refunded_at = now.toISOString()
      await fastify.supabase.from('payments').update(updateData).eq('id', payment.id)
    }

    await fastify.supabase.from('reservations').update({ status: 'cancelled' }).eq('id', id)

    await fastify.supabase.from('cancellations').insert({
      reservation_id: id,
      cancelled_by: authUser.id,
      reason,
      cancelled_at: now.toISOString(),
      hours_before_start: parseFloat(Math.max(0, hoursBeforeStart).toFixed(2)),
      penalty_applied: penaltyApplied,
      clinic_amount: clinicAmount,
      psychologist_amount: psychologistAmount,
    })

    if (shouldCreateRepasse && psychologistAmount > 0) {
      await fastify.supabase.from('repasses').insert({
        reservation_id: id,
        psychologist_id: reservation.psychologist_id,
        amount: psychologistAmount,
        status: 'pending',
      })
    }

    // Reembolso no MP — não falha o cancelamento se o MP retornar erro
    if (shouldRefundMP && payment?.mp_payment_id) {
      try {
        const mp = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN! })
        const refundClient = new PaymentRefund(mp)
        await refundClient.create({ payment_id: Number(payment.mp_payment_id), body: {} })
      } catch (err: any) {
        fastify.log.error({ err, reservationId: id }, 'Erro ao processar reembolso no MP')
      }
    }

    return reply.send({
      cancelled: true,
      penalty_applied: penaltyApplied,
      refunded: newPaymentStatus === 'refunded',
      psychologist_amount: psychologistAmount,
      clinic_amount: clinicAmount,
    })
  })

  // POST /cron/no-show
  // Chamado pelo Railway Cron Job a cada 15 min
  // Header obrigatório: Authorization: Bearer <CRON_SECRET>
  fastify.post('/cron/no-show', async (request, reply) => {
    const cronSecret = process.env.CRON_SECRET
    if (cronSecret) {
      const auth = request.headers.authorization
      if (auth !== `Bearer ${cronSecret}`) {
        return reply.status(401).send({ error: 'Não autorizado' })
      }
    }

    const now = new Date().toISOString()

    const { data: expired, error } = await fastify.supabase
      .from('reservations')
      .select('id, psychologist_id, total_amount, psychologists(penalty_split_rate)')
      .eq('status', 'confirmed')
      .lt('end_at', now)

    if (error) return reply.status(500).send({ error: error.message })
    if (!expired || expired.length === 0) return reply.send({ processed: 0 })

    let processed = 0

    for (const reservation of expired) {
      // Idempotência: não reprocessar se já tem registro de cancelamento
      const { data: existing } = await fastify.supabase
        .from('cancellations')
        .select('id')
        .eq('reservation_id', reservation.id)
        .maybeSingle()

      if (existing) continue

      const amount = Number(reservation.total_amount)
      const splitRate = Number(reservation.psychologists?.penalty_split_rate ?? 0.3)
      const { psychologistAmount, clinicAmount } = calcPenalty(amount, splitRate)

      const { data: payment } = await fastify.supabase
        .from('payments')
        .select('id')
        .eq('reservation_id', reservation.id)
        .maybeSingle()

      await fastify.supabase.from('reservations').update({ status: 'no_show' }).eq('id', reservation.id)

      if (payment) {
        await fastify.supabase.from('payments').update({ status: 'retained' }).eq('id', payment.id)
      }

      await fastify.supabase.from('cancellations').insert({
        reservation_id: reservation.id,
        cancelled_by: null,
        reason: 'no_show',
        cancelled_at: now,
        hours_before_start: 0,
        penalty_applied: true,
        clinic_amount: clinicAmount,
        psychologist_amount: psychologistAmount,
      })

      await fastify.supabase.from('repasses').insert({
        reservation_id: reservation.id,
        psychologist_id: reservation.psychologist_id,
        amount: psychologistAmount,
        status: 'pending',
      })

      processed++
    }

    return reply.send({ processed })
  })
}

export default cancellationsRoutes
