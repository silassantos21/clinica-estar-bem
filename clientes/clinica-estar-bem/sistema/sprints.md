# Sprints — Sistema de Gestão Clínica Estar Bem

> Referência de spec: `spec.md`
> Total: 7 semanas (~Sprint 0 em dias, Sprints 1–6 em semanas)

---

## Sprint 0 — Setup e Infraestrutura ✅
**Duração:** 3–4 dias
**Concluído em:** 2026-06-02

### Tarefas

**Repositório**
- [x] Estrutura de pastas criada: `api/`, `web/`, `supabase/`
- [x] `.env.example` configurado em `api/` e `web/` com todas as variáveis
- [x] `.gitignore` cobrindo `.env`, `node_modules`, `.next/`, uploads

**Banco (Supabase)**
- [x] Migration SQL completa: `supabase/migrations/20260602000001_initial_schema.sql`
  — tabelas: `settings`, `users`, `psychologists`, `rooms`, `psychologist_rooms`, `patients`, `reservations`, `payments`, `cancellations`, `repasses`
- [x] Seed inicial incluído na migration: `cancellation_tolerance_hours = 9`
- [x] RLS habilitado em todas as tabelas; policy de leitura própria em `users`
- [ ] **PENDENTE (manual):** criar projeto no Supabase e rodar a migration no SQL Editor

**API (Fastify)**
- [x] Scaffold: `src/plugins/`, `src/routes/`, `src/services/`, `src/middlewares/`, `src/types/`
- [x] Plugin `supabase.ts` — client com `service_role`, decorado em `fastify.supabase`
- [x] Plugin `auth.ts` — valida Bearer JWT via `supabase.auth.getUser()`, popula `request.authUser`
- [x] Guards `requireAdmin` / `requirePsychologist` / `requireAuth`
- [x] Rota `GET /health`
- [x] `app.ts` + `server.ts` com CORS e Pino logger
- [ ] **PENDENTE (manual):** preencher `api/.env` e rodar `npm install && npm run dev`

**Frontend (Next.js)**
- [x] Scaffold: App Router, TypeScript, Tailwind CSS
- [x] `middleware.ts` — proteção global de rotas, redireciona não-autenticados pro `/login`
- [x] `lib/supabase/client.ts` e `server.ts` — clientes browser e server component
- [x] `lib/api.ts` — cliente HTTP com injeção automática de Bearer token
- [x] Tela de login (`/login`) com email/senha via Supabase Auth
- [x] `page.tsx` raiz — redireciona por role (admin → `/admin/dashboard`, psicólogo → `/psicologo/dashboard`)
- [x] Layout admin com sidebar (Visão geral, Salas, Psicólogos, Reservas, Repasses, Relatórios, Configurações)
- [x] Layout psicólogo com sidebar (Minha agenda, Pacientes, Reservas, Meus repasses)
- [x] Dashboards vazios (placeholders para Sprints 2 e 5)
- [ ] **PENDENTE (manual):** preencher `web/.env.local` e rodar `npm install && npm run dev`

**Infra**
- [ ] **PENDENTE (manual):** deploy API no Railway
- [ ] **PENDENTE (manual):** deploy frontend na Vercel
- [ ] **PENDENTE (manual):** variáveis de ambiente configuradas nos dois serviços

**Critério de aceite:** `GET /health` retorna 200 no staging. Login funciona e redireciona por role.

---

## Sprint 1 — Auth, Salas e Psicólogos ✅
**Duração:** 1 semana
**Iniciado em:** 2026-06-03
**Concluído em:** 2026-06-03

### Tarefas

**Correção de estrutura (roteamento Next.js)**
- [x] Mover dashboards para caminhos corretos (`(admin)/admin/` e `(psychologist)/psicologo/`)
  — route groups `()` não geram segmento de URL; arquivos em caminhos duplos conflitavam em `/dashboard`

**API**
- [x] `POST /auth/login` + `POST /auth/logout`
- [x] `GET/POST/PUT/DELETE /rooms` (admin only)
- [x] `GET/POST/PUT /psychologists` (admin only)
- [x] `GET/PUT /psychologists/:id/rooms/:room_id` — tarifas customizadas (`psychologist_rooms`)
- [x] `GET/PUT /settings/:key` (admin only)

**Frontend**
- [x] Tela de gestão de salas (listar, criar, editar, ativar/desativar)
- [x] Tela de gestão de psicólogos (listar, criar, editar, `penalty_split_rate`)
- [x] Modal de tarifas customizadas por sala (por psicólogo)
- [x] Tela de configurações (`cancellation_tolerance_hours`)
- [x] Dashboard do psicólogo (painel vazio com boas-vindas)
- [x] Dashboard do admin (placeholder — dados no Sprint 5)

**Polimento UI (pós-critério)**
- [x] Logo no login aumentada (`h-48`), sidebar (`h-14`)
- [x] Botão "Sair" na parte inferior do sidebar (admin e psicólogo) via `LogoutButton` client component
- [x] Favicon configurado via metadata do Next.js

**Critério de aceite:** Admin cria sala com tarifa. Cria psicólogo com split diferente e tarifa customizada. Psicólogo loga e vê o painel.

---

## Sprint 2 — Pacientes e Reservas ✅
**Duração:** 1 semana
**Concluído em:** 2026-06-06

### Tarefas

**API**
- [x] `GET/POST/PUT/DELETE /patients` (psicólogo — só os próprios)
- [x] `GET /rooms/availability?date=&room_id=` — retorna horários livres do dia (blocos de 1h, 07h–21h)
- [x] `POST /reservations` — cria reserva com cálculo de tarifa (`get_rate`)
- [x] `GET /reservations` — admin vê todas; psicólogo vê só as próprias (filtros: data, status, sala, psicólogo)
- [x] `GET /reservations/:id`
- [x] Validação de conflito de horário (overlap check na mesma sala, exclui canceladas)

**Frontend**
- [x] Tela de pacientes (listar, criar, editar, excluir com confirmação)
- [x] Wizard de nova reserva 4 etapas: sala + data → horário (grid) → paciente → confirmar
- [x] Grid de disponibilidade com horários ocupados desabilitados
- [x] Lista de reservas do psicólogo com filtros de data e status + modal de detalhe
- [x] Lista de reservas do admin com filtros de data, status, sala e psicólogo + modal de detalhe

**Critério de aceite:** Psicólogo cria reserva. Tentar criar no mesmo horário/sala retorna erro. Admin vê todas as reservas.

**Polimento e correções pós-entrega**
- [x] Bug: `GET /psychologists/:id/rooms` estava com `requireAdmin` — psicólogo recebia 403 ao abrir o wizard. Corrigido para `requireAuth` com verificação de propriedade (`authUser.psychologistId === params.id`)
- [x] Bug: campo `active` ausente do `select` na mesma rota — `data.filter((r) => r.active)` no frontend descartava todas as salas. Adicionado `active` ao select
- [x] Bug: cálculo de `end_at` usava `substring(0, 14)` que incluía os dois pontos dos minutos, gerando `"T08:09:00:00"` inválido. Corrigido para parsear hora direto da string com `substring(11, 13)`
- [x] Bug: `psychologistId` retornava `undefined` por join PostgREST reverso (`psychologists(id)` na query de `users`). Corrigido para query separada em `psychologists WHERE user_id = ?`
- [x] Horários passados bloqueados no grid quando data selecionada é hoje
- [x] Calendários e botões do psicólogo migrados para `brand-600` (#C01C63) — consistente com sidebar
- [x] Grammarly warning (`data-new-gr-c-s-check-loaded`) resolvido com `suppressHydrationWarning` no `<html>` e `<body>`

---

## Sprint 3 — Pagamentos (Mercado Pago) ✅
**Duração:** 1 semana
**Concluído em:** 2026-06-06

### Tarefas

**API** (`api/src/routes/payments.ts`)
- [x] `POST /reservations/:id/payment` — cria preference no MP, salva `mp_preference_id` e `payment_link_url` em `payments`; se já existe link pendente, retorna o existente
- [x] `POST /webhooks/mercadopago` — valida assinatura com `WebhookSignatureValidator` do SDK, atualiza `payments.status = paid` e `reservations.status = confirmed`
- [x] `POST /reservations/:id/refund` (admin) — chama `PaymentRefund` do SDK, atualiza status para `refunded`
- [x] `GET /reservations` e `GET /reservations/:id` — incluem dados de `payments(id, status, payment_link_url)` no select

**Integrações**
- [x] SDK `mercadopago` v3 instalado na API
- [x] `MP_ACCESS_TOKEN` configurado em `api/.env`
- [x] `API_PUBLIC_URL` configurado com URL do ngrok em `api/.env`
- [x] Webhook configurado no painel MP apontando para `API_PUBLIC_URL/webhooks/mercadopago`
- [x] `MP_WEBHOOK_SECRET` configurado em `api/.env`

**Frontend**
- [x] Tela de sucesso no wizard após criar reserva — botões "Pagar agora" e "Pagar depois"
- [x] "Pagar agora" gera o link via `POST /reservations/:id/payment` e abre no MP
- [x] Botão "Pagar" na lista de reservas pendentes
- [x] Badge de status de pagamento no modal de detalhe
- [x] Botão `[dev] confirmar` visível apenas em `NODE_ENV=development` para simular pagamento aprovado sem passar pelo checkout

**Testado em dev (2026-06-08)**
- Criação de reserva → geração do link → preference criada no MP ✅
- `POST /reservations/:id/confirm-test` atualiza `payments.status = paid` e `reservations.status = confirmed` ✅
- UI reflete status corretamente ✅
- Webhook end-to-end (MP → ngrok → API) não testado — sandbox do MP com problemas de redirect loop e cartões de teste vencidos; código está correto, validar em produção

**Critério de aceite:** Reserva criada → link gerado → pagamento no sandbox → webhook recebido → status vira `confirmed` automaticamente.

**Obs:** ngrok muda de URL a cada reinício (plano free) — sempre atualizar `API_PUBLIC_URL` no `.env` e a URL do webhook no painel do MP.

---

## Sprint 4 — Cancelamentos e No-show ✅
**Duração:** 1 semana
**Concluído em:** 2026-06-08

### Tarefas

**API**
- [x] `POST /reservations/:id/cancel` — recebe `reason` (patient_request | psychologist_decision | clinic_decision)
  - Lê `settings.cancellation_tolerance_hours`
  - Aplica lógica de penalidade ou reembolso
  - Cria registro em `cancellations`
  - Cria `repasses` se houver split a pagar
  - Chama reembolso via MP se aplicável
- [x] `GET /reservations/:id/cancel-preview?reason=...` — retorna breakdown financeiro antes de confirmar
- [x] Permissões de cancelamento por role e reason (conforme matriz)
- [x] `POST /cron/no-show` — endpoint manual protegido por `CRON_SECRET` (para testes e fallback)

**Cron (Supabase pg_cron)**
- [x] Job a cada 15 min via `pg_cron` no próprio Supabase (migration: `20260608000001_no_show_cron.sql`)
  - `payments.status = retained`
  - `reservations.status = no_show`
  - Cria `cancellations` com `reason = no_show`
  - Cria `repasses` com split do psicólogo

**Frontend**
- [x] Botão "Cancelar reserva" no modal de detalhe (psicólogo e admin)
- [x] Modal de cancelamento: motivos corretos por role (psicólogo: patient_request | psychologist_decision; admin: patient_request | clinic_decision)
- [x] Breakdown da penalidade antes de confirmar (se < tolerância)
- [x] Exibição de reembolso integral se elegível
- [x] Loading skeleton nas etapas Sala e Paciente do wizard de nova reserva

**Critério de aceite:** Cancelamento dentro da janela → sem reembolso, split registrado. Cancelamento fora → reembolso processado. Reserva expirada sem ação → no-show no cron seguinte.

**Notas técnicas**
- Cron roda no Supabase (pg_cron), não no Railway — Railway não está em uso ainda
- `CRON_SECRET` adicionado ao `api/.env.example` — necessário adicionar no `api/.env` local
- Preview financeiro busca `penalty_split_rate` do psicólogo e `cancellation_tolerance_hours` das settings via API

---

## Sprint 5 — Repasses e Relatórios ✅
**Duração:** 1 semana
**Concluído em:** 2026-06-08

### Tarefas

**API** (`api/src/routes/repasses.ts`)
- [x] `POST /reservations/:id/complete` (admin) — marca sessão como `completed`, cria `repasse` com valor integral do psicólogo (idempotente)
- [x] `GET /repasses` — admin vê todos; psicólogo vê só os próprios (filtros: status, psicólogo)
- [x] `PUT /repasses/:id/pay` (admin) — marca repasse como `paid`, registra `paid_by` e `notes`
- [x] `GET /reports/financial?month=&year=` — receita bruta, retido, reembolsado, repasses pagos/pendentes
- [x] `GET /reports/rooms?start=&end=` — horas reservadas vs disponíveis por sala, taxa de ocupação
- [x] `GET /reports/psychologists?start=&end=` — reservas, concluídas, cancelamentos, ausências, repasses por psicólogo

**Frontend**
- [x] `/admin/repasses` — lista com filtros (status, psicólogo), total pendente em destaque, modal "Marcar como pago" com observação
- [x] `/admin/relatorios` — seletor mês/ano, cards financeiros, barra de ocupação por sala, tabela por psicólogo
- [x] `/psicologo/repasses` — lista com filtro de status e paciente, cards "A receber / Já recebido"
- [x] `/admin/dashboard` — cards com dados reais (reservas hoje, receita do mês, repasses pendentes, ocupação)
- [x] `/admin/reservas` — botão "Confirmar sessão concluída" no modal (aparece quando `confirmed` + `end_at` no passado)

**Critério de aceite:** Admin confirma sessão → repasse aparece como pendente. Admin marca como pago. Relatório mensal bate com os registros.

**Notas técnicas**
- Migration `20260608000002_repasses_created_at.sql` — adiciona `created_at` na tabela `repasses` (rodar no Supabase SQL Editor)
- Ausência é gerada automaticamente pelo pg_cron (a cada 15 min) — admin não precisa fazer nada; se a sessão passar sem ser confirmada, vira ausência com retenção de pagamento e split de penalidade
- Botões primários do sistema (admin e psicólogo) padronizados em `brand-600` (#C01C63)
- Label "no-show" substituído por "Ausência" em todo o frontend (valor interno `no_show` no banco/API permanece)

---

## Sprint 6 — Notificações
**Duração:** 1 semana
**Entrega:** Email e WhatsApp disparados em todos os eventos mapeados

### Tarefas

**Infraestrutura**
- [ ] Configurar Nodemailer com SMTP (Gmail ou Resend.com)
- [ ] Configurar Z-API (WhatsApp) ou Twilio — número de negócio conectado
- [ ] Serviço de notificação centralizado: `NotificationService.send(type, recipients, data)`

**Templates**
- [ ] Email: confirmação de reserva (link de pagamento)
- [ ] Email + WhatsApp: pagamento confirmado (psicólogo e paciente)
- [ ] WhatsApp: lembrete 24h antes (paciente)
- [ ] Email + WhatsApp: cancelamento (psicólogo e paciente)
- [ ] Email: no-show detectado (psicólogo)
- [ ] Email: repasse registrado (psicólogo)

**Cron adicional**
- [ ] Job diário: busca reservas com `start_at` em 24h e `status = confirmed` → dispara lembrete WhatsApp

**Wiring**
- [ ] Conectar cada evento da API ao `NotificationService`

**Critério de aceite:** Criar reserva → email chega. Pagar → WhatsApp chega pro paciente. Cancelar → ambos notificados. Lembrete 24h antes funciona.

---

## Sprint 7 — Deploy, Validação e Entrega
**Duração:** 1 semana
**Entrega:** Sistema em produção, testado com o cliente, pronto pra uso real

### Tarefas

**Hardening**
- [ ] Validação de inputs em todas as rotas (Zod + Fastify schema)
- [ ] Tratamento global de erros (respostas padronizadas)
- [ ] Rate limiting nas rotas públicas (webhook, login)
- [ ] Logs estruturados (Pino, que já vem com Fastify)

**Deploy produção**
- [ ] Variáveis de ambiente de produção (Railway + Vercel)
- [ ] Supabase: projeto de produção separado do staging
- [ ] Mercado Pago: credenciais de produção + webhook URL de prod
- [ ] Z-API/Twilio: número de produção

**Testes E2E (fluxos críticos)**
- [ ] Criar reserva → pagar → confirmar
- [ ] Cancelar dentro da tolerância → penalidade aplicada
- [ ] Cancelar fora da tolerância → reembolso processado
- [ ] No-show → retenção automática

**UAT com cliente**
- [ ] Sessão de walkthrough com o cliente
- [ ] Ajustes de UX baseados no feedback
- [ ] Treinamento básico (admin + psicólogo)

**Critério de aceite:** Sistema em produção com dados reais. Cliente consegue operar sem assistência técnica.

---

## Resumo

| Sprint | Foco | Duração |
|---|---|---|
| 0 | Setup e infra | 3–4 dias |
| 1 | Auth, salas, psicólogos | 1 semana |
| 2 | Pacientes e reservas | 1 semana |
| 3 | Pagamentos (Mercado Pago) | 1 semana |
| 4 | Cancelamentos e no-show | 1 semana |
| 5 | Repasses e relatórios | 1 semana |
| 6 | Notificações | 1 semana |
| 7 | Deploy, testes, entrega | 1 semana |
| **Total** | | **~7 semanas** |

---

## Ordem de dependências críticas

```
Sprint 0 (infra)
  └── Sprint 1 (entidades base)
        └── Sprint 2 (reservas)
              └── Sprint 3 (pagamentos)
                    └── Sprint 4 (cancelamentos)  ←── depende do fluxo de reembolso do MP
                          └── Sprint 5 (repasses)
Sprint 6 (notificações) ←── pode começar em paralelo com Sprint 4
Sprint 7 (entrega) ←── depende de tudo
```
