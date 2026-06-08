import { FastifyPluginAsync } from 'fastify'
import { MercadoPagoConfig, Preference, Payment, PaymentRefund, WebhookSignatureValidator, InvalidWebhookSignatureError } from 'mercadopago'
import { requireAuth, requireAdmin } from '../middlewares/guards.js'

const paymentsRoutes: FastifyPluginAsync = async (fastify) => {
  const mp = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN! })

  // POST /reservations/:id/payment
  // Cria preference no MP e salva link de pagamento
  fastify.post<{ Params: { id: string } }>(
    '/reservations/:id/payment',
    { preHandler: requireAuth },
    async (request, reply) => {
      const { id } = request.params
      const { authUser } = request

      const { data: reservation, error: resErr } = await fastify.supabase
        .from('reservations')
        .select('*, rooms(name), patients(name)')
        .eq('id', id)
        .single()

      if (resErr || !reservation) {
        return reply.status(404).send({ error: 'Reserva não encontrada' })
      }

      if (authUser.role === 'psychologist' && reservation.psychologist_id !== authUser.psychologistId) {
        return reply.status(403).send({ error: 'Sem permissão para esta reserva' })
      }

      if (reservation.status === 'cancelled') {
        return reply.status(409).send({ error: 'Reserva cancelada não pode ser paga' })
      }

      // Se já tem payment pendente com link, devolver o existente
      const { data: existingPayment } = await fastify.supabase
        .from('payments')
        .select('id, status, payment_link_url, mp_preference_id')
        .eq('reservation_id', id)
        .maybeSingle()

      if (existingPayment?.status === 'paid') {
        return reply.status(409).send({ error: 'Reserva já foi paga' })
      }

      if (existingPayment?.payment_link_url && existingPayment.status === 'pending') {
        return reply.send({ payment_link_url: existingPayment.payment_link_url })
      }

      // Montar descrição do item
      const patientName = reservation.patients?.name ?? 'Paciente'
      const roomName = reservation.rooms?.name ?? 'Sala'
      const startDate = reservation.start_at.substring(0, 10)
      const startHour = reservation.start_at.substring(11, 16)

      const prefClient = new Preference(mp)
      const preference = await prefClient.create({
        body: {
          items: [
            {
              id,
              title: `Sessão ${patientName} — ${roomName} — ${startDate} ${startHour}`,
              quantity: 1,
              unit_price: Number(reservation.total_amount),
              currency_id: 'BRL',
            },
          ],
          external_reference: id,
          // notification_url precisa ser URL pública — configurar API_PUBLIC_URL com URL do ngrok em dev
          ...(process.env.API_PUBLIC_URL
            ? { notification_url: `${process.env.API_PUBLIC_URL}/webhooks/mercadopago` }
            : {}),
        },
      })

      // sandbox_init_point para credenciais de teste; init_point para produção
      const paymentLinkUrl = preference.sandbox_init_point ?? preference.init_point!

      if (existingPayment) {
        await fastify.supabase
          .from('payments')
          .update({ mp_preference_id: preference.id, payment_link_url: paymentLinkUrl })
          .eq('id', existingPayment.id)
      } else {
        await fastify.supabase.from('payments').insert({
          reservation_id: id,
          amount: reservation.total_amount,
          status: 'pending',
          mp_preference_id: preference.id,
          payment_link_url: paymentLinkUrl,
        })
      }

      return reply.status(201).send({ payment_link_url: paymentLinkUrl })
    },
  )

  // POST /webhooks/mercadopago
  // Valida assinatura HMAC e atualiza status da reserva
  fastify.post('/webhooks/mercadopago', async (request, reply) => {
    const body = request.body as { data?: { id?: string }; type?: string; action?: string }
    const xSignature = request.headers['x-signature'] as string | undefined
    const xRequestId = request.headers['x-request-id'] as string | undefined
    const dataId = String(body?.data?.id ?? '')

    // Validar assinatura quando o secret estiver configurado (não placeholder)
    const webhookSecret = process.env.MP_WEBHOOK_SECRET
    if (webhookSecret && webhookSecret !== 'seu-webhook-secret' && xSignature) {
      try {
        WebhookSignatureValidator.validate({
          xSignature,
          xRequestId: xRequestId ?? '',
          dataId,
          secret: webhookSecret,
        })
      } catch (err) {
        if (err instanceof InvalidWebhookSignatureError) {
          return reply.status(401).send({ error: 'Assinatura de webhook inválida' })
        }
        throw err
      }
    }

    // Processar apenas eventos de pagamento aprovado
    if ((body?.type !== 'payment' && body?.action !== 'payment.updated') || !dataId) {
      return reply.send({ received: true })
    }

    // Buscar detalhes do pagamento no MP
    const paymentClient = new Payment(mp)
    let mpPayment
    try {
      mpPayment = await paymentClient.get({ id: Number(dataId) })
    } catch {
      return reply.send({ received: true })
    }

    const externalRef = mpPayment.external_reference // = reservation_id
    const mpStatus = mpPayment.status

    if (!externalRef) return reply.send({ received: true })

    const { data: payment } = await fastify.supabase
      .from('payments')
      .select('id')
      .eq('reservation_id', externalRef)
      .maybeSingle()

    if (!payment) return reply.send({ received: true })

    if (mpStatus === 'approved') {
      await Promise.all([
        fastify.supabase
          .from('payments')
          .update({
            status: 'paid',
            mp_payment_id: String(dataId),
            paid_at: new Date().toISOString(),
          })
          .eq('id', payment.id),
        fastify.supabase
          .from('reservations')
          .update({ status: 'confirmed' })
          .eq('id', externalRef),
      ])
    }

    return reply.send({ received: true })
  })

  // POST /reservations/:id/refund — admin only
  fastify.post<{ Params: { id: string } }>(
    '/reservations/:id/refund',
    { preHandler: requireAdmin },
    async (request, reply) => {
      const { id } = request.params

      const { data: payment } = await fastify.supabase
        .from('payments')
        .select('id, mp_payment_id, status')
        .eq('reservation_id', id)
        .maybeSingle()

      if (!payment) return reply.status(404).send({ error: 'Pagamento não encontrado' })
      if (payment.status !== 'paid') return reply.status(409).send({ error: 'Pagamento não está em estado pago' })
      if (!payment.mp_payment_id) return reply.status(409).send({ error: 'ID do pagamento MP não disponível' })

      const refundClient = new PaymentRefund(mp)
      try {
        await refundClient.create({ payment_id: Number(payment.mp_payment_id), body: {} })
      } catch (err: any) {
        return reply.status(500).send({ error: `Erro no reembolso MP: ${err.message}` })
      }

      await fastify.supabase
        .from('payments')
        .update({ status: 'refunded', refunded_at: new Date().toISOString() })
        .eq('id', payment.id)

      return reply.send({ refunded: true })
    },
  )
  // POST /reservations/:id/confirm-test — só disponível em desenvolvimento
  // Simula webhook aprovado sem passar pelo MP
  if (process.env.NODE_ENV === 'development') {
    fastify.post<{ Params: { id: string } }>(
      '/reservations/:id/confirm-test',
      { preHandler: requireAuth },
      async (request, reply) => {
        const { id } = request.params

        const { data: reservation } = await fastify.supabase
          .from('reservations')
          .select('id, status, total_amount')
          .eq('id', id)
          .single()

        if (!reservation) return reply.status(404).send({ error: 'Reserva não encontrada' })
        if (reservation.status === 'confirmed') return reply.send({ message: 'Já confirmada' })

        const { data: existingPayment } = await fastify.supabase
          .from('payments')
          .select('id')
          .eq('reservation_id', id)
          .maybeSingle()

        if (!existingPayment) {
          await fastify.supabase.from('payments').insert({
            reservation_id: id,
            amount: reservation.total_amount,
            status: 'paid',
            mp_payment_id: 'test-' + Date.now(),
            paid_at: new Date().toISOString(),
          })
        } else {
          await fastify.supabase
            .from('payments')
            .update({ status: 'paid', mp_payment_id: 'test-' + Date.now(), paid_at: new Date().toISOString() })
            .eq('id', existingPayment.id)
        }

        await fastify.supabase
          .from('reservations')
          .update({ status: 'confirmed' })
          .eq('id', id)

        return reply.send({ confirmed: true })
      },
    )
  }
}

export default paymentsRoutes
