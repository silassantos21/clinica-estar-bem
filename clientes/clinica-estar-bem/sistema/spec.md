# Spec — Sistema de Gestão Clínica Estar Bem

> Gerado em: 2026-06-02
> Status: Aprovado — aguardando desenvolvimento

---

## Contexto

Sistema de gestão para clínica de psicologia que opera no modelo coworking (sublocação de salas). Psicólogos reservam salas para atender seus pacientes. Pagamento antecipado com política de cancelamento.

---

## Stack

| Camada | Tecnologia |
|---|---|
| Banco | PostgreSQL via Supabase |
| Auth | Supabase Auth (JWT) |
| API | Node.js + Fastify |
| Frontend | Next.js (React) |
| Gateway | Mercado Pago (link de pagamento + webhooks) |
| Notificações | Nodemailer (email) + Z-API ou Twilio (WhatsApp) |
| Deploy API | Railway |
| Deploy Frontend | Vercel |

---

## Arquitetura de Dados

**`settings`**
`key` · `value` · `updated_at`
> Linha inicial: `cancellation_tolerance_hours = 9`

**`users`**
`id` · `name` · `email` · `role` ENUM(admin | psychologist) · `phone` · `active` · `created_at`

**`psychologists`**
`id` · `user_id` FK → users · `crp` · `penalty_split_rate` DECIMAL(3,2)

**`rooms`**
`id` · `name` · `floor` · `hourly_rate` DECIMAL (tarifa padrão) · `active`

**`psychologist_rooms`** *(tarifa por contrato)*
`id` · `psychologist_id` FK · `room_id` FK · `custom_rate` DECIMAL (nullable — se null, usa rooms.hourly_rate)
UNIQUE(psychologist_id, room_id)

**`patients`**
`id` · `psychologist_id` FK · `name` · `phone` · `email`

**`reservations`**
`id` · `psychologist_id` FK · `room_id` FK · `patient_id` FK · `start_at` DATETIME · `end_at` DATETIME (= start_at + 1h) · `total_amount` DECIMAL · `status` ENUM(pending | confirmed | cancelled | completed | no_show) · `created_at`

**`payments`**
`id` · `reservation_id` FK (1:1) · `amount` DECIMAL · `status` ENUM(pending | paid | refunded | retained) · `mp_preference_id` · `mp_payment_id` · `payment_link_url` · `paid_at` · `refunded_at`

**`cancellations`**
`id` · `reservation_id` FK (1:1) · `cancelled_by` FK → users · `reason` ENUM(patient_request | psychologist_decision | clinic_decision | no_show) · `cancelled_at` DATETIME · `hours_before_start` DECIMAL · `penalty_applied` BOOL · `clinic_amount` DECIMAL · `psychologist_amount` DECIMAL

**`repasses`**
`id` · `reservation_id` FK · `psychologist_id` FK · `amount` DECIMAL · `status` ENUM(pending | paid) · `paid_at` · `paid_by` FK → users · `notes`

---

## Relacionamentos

```
users 1──1 psychologists
psychologists 1──N patients
psychologists 1──N reservations
psychologists N──M rooms  (via psychologist_rooms)
rooms 1──N reservations
reservations 1──1 payments
reservations 1──1 cancellations  (condicional)
reservations 1──1 repasses       (condicional)
```

---

## Lógica de Tarifa

```
FUNCTION get_rate(psychologist_id, room_id):
  override ← psychologist_rooms.find(psychologist_id, room_id)
  RETURN override.custom_rate ?? room.hourly_rate
```

---

## Lógica do Gatilho — Cancelamento

```
FUNCTION process_cancellation(reservation_id, cancelled_by, reason, now):

  r         ← Reservation.find(reservation_id)
  payment   ← Payment.find(reservation_id)
  psych     ← Psychologist.find(r.psychologist_id)
  tolerance ← Settings.get('cancellation_tolerance_hours').to_float

  IF reason IN [psychologist_decision, clinic_decision]:
    payment.status  ← REFUNDED
    penalty_applied ← FALSE
    clinic_amount   ← 0 · psych_amount ← 0
    trigger_refund(payment)

  ELSE IF reason = patient_request:
    hours_ahead ← (r.start_at − now).to_hours

    IF hours_ahead >= tolerance:
      payment.status  ← REFUNDED
      penalty_applied ← FALSE
      clinic_amount   ← 0 · psych_amount ← 0
      trigger_refund(payment)

    ELSE:
      psych_amount    ← payment.amount × psych.penalty_split_rate
      clinic_amount   ← payment.amount × (1 − psych.penalty_split_rate)
      payment.status  ← RETAINED
      penalty_applied ← TRUE

  r.status ← CANCELLED
  Cancellation.create(reason, penalty_applied, clinic_amount, psych_amount, ...)
```

**Job de no-show (cron a cada 15 min):**
```
FOR each reservation WHERE status = 'confirmed' AND end_at < now:
  psych_amount  ← payment.amount × psych.penalty_split_rate
  clinic_amount ← payment.amount × (1 − psych.penalty_split_rate)
  payment.status     ← RETAINED
  reservation.status ← no_show
  Cancellation.create(reason = no_show, penalty_applied = TRUE, ...)
  Repasse.create(amount = psych_amount, status = pending)
  notify_psychologist(no_show)
```

---

## Fluxo Financeiro

| Evento | reservations.status | payments.status | repasses |
|---|---|---|---|
| Reserva criada | pending | pending | — |
| Link MP pago (webhook) | confirmed | paid | — |
| Cancelamento ≥ tolerância (paciente) | cancelled | refunded | — |
| Cancelamento < tolerância (paciente) | cancelled | retained | pending ← split psicólogo |
| Cancelamento por psicólogo / admin | cancelled | refunded | — |
| No-show (cron) | no_show | retained | pending ← split psicólogo |
| Sessão confirmada pelo admin | completed | paid | pending ← valor do psicólogo |
| Admin registra repasse | — | — | paid |

---

## Webhook Mercado Pago

```
POST /webhooks/mercadopago
  ← mp_payment_id, status

  IF status = 'approved':
    payment ← Payment.find_by(mp_payment_id)
    payment.status      ← paid
    payment.paid_at     ← now
    reservation.status  ← confirmed
    notify(psychologist + patient, 'confirmado')
```

---

## Permissões

| Ação | Admin | Psicólogo |
|---|---|---|
| Gerenciar salas e tarifas | ✓ | ✗ |
| Definir tarifa customizada por psicólogo | ✓ | ✗ |
| Ver todas as reservas | ✓ | Só próprias |
| Criar reserva | ✓ | ✓ |
| Cancelar — patient_request | ✓ | Só próprias |
| Cancelar — psychologist_decision | ✗ | Só próprias |
| Cancelar — clinic_decision | ✓ | ✗ |
| Confirmar sessão como completed | ✓ | ✗ |
| Registrar repasse como pago | ✓ | ✗ |
| Editar settings | ✓ | ✗ |
| Ver relatórios financeiros | ✓ | Só próprios repasses |

---

## Notificações

| Gatilho | Canal | Destinatário |
|---|---|---|
| Reserva criada (link gerado) | Email | Psicólogo |
| Pagamento confirmado | Email + WhatsApp | Psicólogo + Paciente |
| Lembrete 24h antes | WhatsApp | Paciente |
| Cancelamento | Email + WhatsApp | Psicólogo + Paciente |
| No-show detectado | Email | Psicólogo |
| Repasse registrado | Email | Psicólogo |

---

## Relatórios MVP

- **Financeiro mensal:** receita bruta · retido · reembolsado · repasses pagos · pendentes
- **Ocupação por sala:** horas reservadas vs disponíveis no período
- **Histórico por psicólogo:** reservas · cancelamentos · taxa de no-show · repasses
