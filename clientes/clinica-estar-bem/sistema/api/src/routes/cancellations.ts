import { FastifyPluginAsync } from 'fastify'
import { requireAuth } from '../middlewares/guards.js'
import { sendWhatsApp, msgCancelamento } from '../services/notifications.js'

async function getTolerance(fastify: any): Promise<number> {
  const { data } = await fastify.supabase
    .from('settings')
    .select('value')
    .eq('key', 'cancellation_tolerance_hours')
    .single()
  return parseFloat(data?.value ?? '5')
}

const cancellationsRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /reservations/:id/cancel
  // Profissional só pode cancelar se faltam >= tolerance_hours para o início
  // Admin pode cancelar qualquer reserva confirmada sem restrição de janela
  fastify.post<{ Params: { id: string } }>(
    '/reservations/:id/cancel',
    { preHandler: requireAuth },
    async (request, reply) => {
      const { id } = request.params
      const { authUser } = request

      const { data: reservation, error: resErr } = await fastify.supabase
        .from('reservations')
        .select('id, status, start_at, professional_id, professionals(users(name, phone)), rooms(name)')
        .eq('id', id)
        .single()

      if (resErr || !reservation) return reply.status(404).send({ error: 'Reserva não encontrada' })

      if (reservation.status === 'cancelled') {
        return reply.status(409).send({ error: 'Reserva já cancelada' })
      }

      // Profissional só pode cancelar a própria reserva
      if (authUser.role === 'professional') {
        if (reservation.professional_id !== authUser.professionalId) {
          return reply.status(403).send({ error: 'Sem permissão para cancelar esta reserva' })
        }

        // Verifica janela de cancelamento
        const tolerance = await getTolerance(fastify)
        const now = new Date()
        const startAt = new Date(reservation.start_at)
        const hoursBeforeStart = (startAt.getTime() - now.getTime()) / (1000 * 60 * 60)

        if (hoursBeforeStart < tolerance) {
          return reply.status(403).send({
            error: `Cancelamento não permitido — faltam menos de ${tolerance} horas para o horário agendado`,
            hours_before_start: Math.max(0, parseFloat(hoursBeforeStart.toFixed(1))),
            tolerance_hours: tolerance,
          })
        }

        const now2 = new Date()
        const hoursBeforeStartFinal = (startAt.getTime() - now2.getTime()) / (1000 * 60 * 60)

        await fastify.supabase.from('reservations').update({ status: 'cancelled' }).eq('id', id)
        await fastify.supabase.from('cancellations').insert({
          reservation_id: id,
          cancelled_by: authUser.id,
          cancelled_at: now2.toISOString(),
          hours_before_start: parseFloat(Math.max(0, hoursBeforeStartFinal).toFixed(2)),
        })

        // Notificação WhatsApp — fire-and-forget
        const profUser = (reservation as any)?.professionals?.users
        sendWhatsApp(
          profUser?.phone,
          msgCancelamento(profUser?.name ?? 'Profissional', (reservation as any)?.rooms?.name ?? 'Sala', reservation.start_at),
        )

        return reply.send({ cancelled: true })
      }

      // Admin cancela sem restrição de horário
      const now = new Date()
      const startAt = new Date(reservation.start_at)
      const hoursBeforeStart = (startAt.getTime() - now.getTime()) / (1000 * 60 * 60)

      await fastify.supabase.from('reservations').update({ status: 'cancelled' }).eq('id', id)
      await fastify.supabase.from('cancellations').insert({
        reservation_id: id,
        cancelled_by: authUser.id,
        cancelled_at: now.toISOString(),
        hours_before_start: parseFloat(Math.max(0, hoursBeforeStart).toFixed(2)),
      })

      // Notificação WhatsApp — fire-and-forget
      const profUser = (reservation as any)?.professionals?.users
      sendWhatsApp(
        profUser?.phone,
        msgCancelamento(profUser?.name ?? 'Profissional', (reservation as any)?.rooms?.name ?? 'Sala', reservation.start_at),
      )

      return reply.send({ cancelled: true })
    },
  )
}

export default cancellationsRoutes
