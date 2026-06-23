# Sprints — Sistema de Agendamento Núcleo Estar Bem

> Referência de spec: `spec.md`
> Versão: v1 (agendamento sem pagamento)
> v2 (pagamentos, repasses, no-show) planejada para fase futura

---

## Histórico — v0 (concluído em 2026-06-08)

Sprints 0–5 foram desenvolvidas com escopo de coworking com pagamento antecipado (Mercado Pago, repasses, penalidades). Após feedback do cliente, o escopo foi reformulado para foco em agendamento simples. O código das Sprints 0–5 serve de base estrutural — módulos de pagamento e repasse serão removidos na Sprint R1.

---

## Sprint R1 — Limpeza e base nova
**Status:** CONCLUÍDA (2026-06-22)
**Estimativa:** 2–3 dias

### Banco (Supabase)
- [x] Nova migration descartando schema anterior (dados de teste — ok apagar)
- [x] Tabelas mantidas (simplificadas): `settings`, `users`, `professionals`, `rooms`, `reservations`, `cancellations`
- [x] Nova tabela: `room_blocks` (`id`, `room_id` FK, `date` DATE, `hour` INT, `blocked_by` FK → users, `reason` TEXT, `created_at`)
- [x] Tabelas removidas: `payments`, `repasses`, `patients`, `psychologist_rooms`
- [x] `rooms`: remover `hourly_rate` e `floor`; adicionar `number` INT (1–5)
- [x] `reservations`: remover `patient_id` e `total_amount`; status = `confirmed | cancelled`
- [x] `cancellations`: remover campos financeiros (`penalty_applied`, `clinic_amount`, `psychologist_amount`)
- [x] `professionals`: remover `crp` e `penalty_split_rate`
- [x] Seed: 5 salas (Sala 1 a Sala 5), `cancellation_tolerance_hours = 5`

### API
- [x] Remover `api/src/routes/payments.ts` e `api/src/routes/repasses.ts`
- [x] Renomear `psychologists.ts` → `professionals.ts` e todas as rotas `/psychologists` → `/professionals`
- [x] Atualizar guards: `requirePsychologist` → `requireProfessional`
- [x] Remover toda referência a `patient_id`, `total_amount`, `hourly_rate`, `penalty_split_rate` nas rotas de reservas
- [x] Simplificar `POST /reservations` — sem cálculo de tarifa, sem criação de payment
- [x] `GET /rooms/availability` — incluir `room_blocks` na verificação de disponibilidade
- [x] Adicionar `PUT /auth/change-password` — profissional altera a própria senha

### Frontend
- [x] Renomear "Clínica Estar Bem" → "Núcleo Estar Bem" em todo o sistema (títulos, textos, metadata)
- [x] Renomear "psicólogo/psicóloga" → "profissional" em toda a UI
- [x] Sidebar admin: remover "Repasses" e "Relatórios" (serão recriados na R4)
- [x] Sidebar profissional: remover "Pacientes" e "Meus repasses"
- [x] Wizard de reserva: reduzir de 4 para 3 etapas (sala + data → horário → confirmar)
- [x] Remover etapa de paciente e todos os componentes de paciente
- [x] Remover telas: `/admin/repasses`, `/admin/relatorios`, `/psicologo/repasses`
- [x] Tela de perfil do profissional com opção "Alterar senha"
- [x] Tela de perfil do admin com opção "Alterar senha"

**Critério de aceite:** Admin cria profissional com senha temporária. Profissional loga, faz reserva de Sala 2 às 10h, vê a reserva na lista. Admin vê a reserva no painel. ✅ Testado localmente.

---

## Sprint R2 — Bloqueio de vagas pelo admin
**Status:** CONCLUÍDA (2026-06-22)
**Estimativa:** 1–2 dias

### API ✅ implementada em R1
- [x] `POST /rooms/:id/blocks` (admin) — bloqueia `{ date, hour, reason }`
- [x] `DELETE /rooms/:id/blocks/:block_id` (admin) — desbloqueia
- [x] `GET /rooms/:id/blocks?date=` — lista bloqueios do dia
- [x] `GET /rooms/availability` já considera `room_blocks` (slot bloqueado = indisponível)

### Frontend ✅
- [x] Nova tela `/admin/bloqueios` — grid Hora × Sala (7–21h × Salas 1–5)
- [x] Clique em slot livre → modal "Bloquear horário" (sala, data, hora, motivo)
- [x] Clique em slot bloqueado → modal "Desbloquear" com motivo exibido
- [x] Horários passados do dia atual: desabilitados (cinza claro para livres, laranja apagado para bloqueados)
- [x] "Bloqueios" adicionado no sidebar admin
- [x] `api.ts` corrigido para tratar resposta 204 sem body (DELETE)

**Critério de aceite:** Admin bloqueia Sala 3 das 14h às 15h. Profissional não vê esse horário como disponível no wizard. ✅

---

## Sprint R3 — Cancelamento simplificado
**Status:** CONCLUÍDA (2026-06-22)
**Estimativa:** 1 dia

### API ✅ (implementada em R1)
- [x] `POST /reservations/:id/cancel` — profissional: verifica janela de 5h; retorna 403 com `{ error, hours_before_start, tolerance_hours }` se dentro da janela
- [x] Sem lógica de penalidade, reembolso ou split
- [x] Admin cancela sem restrição de janela

### Frontend ✅
- [x] Botão "Cancelar reserva" desabilitado (cinza, cursor-not-allowed) quando `hoursUntil < 5h`
- [x] Mensagem abaixo do botão: "Cancelamento encerrado — faltam menos de 5h para o horário"
- [x] Botão escondido quando reserva já passou (`hoursUntil <= 0`)
- [x] Admin: botão sempre habilitado para qualquer reserva confirmada (sem restrição)

**Critério de aceite:** Reserva para daqui a 3h — botão desabilitado para o profissional, habilitado para o admin. Reserva para daqui a 6h — cancelamento funciona para ambos. ✅

---

## Sprint R4 — Relatórios (semanal e mensal)
**Status:** CONCLUÍDA (2026-06-22)
**Estimativa:** 2 dias

### API ✅
- [x] `GET /reports/weekly?start=YYYY-MM-DD` — agrupamento por profissional, 7 dias a partir de `start`
- [x] `GET /reports/monthly?month=M&year=YYYY` — mesma estrutura, escopo mensal
- [x] Resposta: `{ start, end, rows: [{ name, reservations_count, cancellations_count, rooms_used[] }] }`
- [x] Contagem baseada em `reservations.status` (confirmed/cancelled) com `start_at` no período

### Frontend ✅
- [x] `/admin/relatorios` — toggle "Semanal / Mensal" + navegação de período (setas prev/next)
- [x] Tabela: Profissional | Agendamentos | Cancelamentos | Salas utilizadas
- [x] Rodapé com totais gerais
- [x] Botão "Imprimir" com `window.print()` — controles e filtros ocultos com `print:hidden`
- [x] "Relatórios" adicionado no sidebar admin (após Reservas)
- [x] Cabeçalho de impressão com `logo-icon.svg` (h-24), linha magenta, título e período à direita
- [x] Botão "Baixar PDF" via `html2pdf.js` — SVG convertido para PNG via canvas antes de embutir no HTML
- [x] Skeleton de loading (`admin/loading.tsx`) entre transições de página

**Critério de aceite:** Relatório da semana mostra o que cada profissional agendou e o que cancelou. Relatório mensal consolida o mês inteiro. PDF baixado com cabeçalho profissional. ✅

---

## Sprint R5 — Mobile-first
**Status:** CONCLUÍDA (2026-06-22)
**Estimativa:** 2–3 dias

**Contexto:** sistema será usado via celular desde o início (notebook chega em agosto).

- [x] Sidebar colapsável (hamburguer) em telas menores que 768px
- [x] Wizard de reserva funcional em tela de 390px (iPhone 14 Pro)
- [x] Grid de disponibilidade com scroll adequado no mobile
- [x] Cards e tabelas sem scroll horizontal em mobile — convertidos para cards expansíveis
- [x] Botões com área de toque mínima de 44px
- [x] Modal de detalhes da reserva funcional no mobile — substituído por inline expand
- [x] Logo-icon no header mobile (menor, sem fundo branco)
- [x] Select customizado (substitui `<select>` nativo — não estilizável no mobile)
- [x] Cards expansíveis: reservas (data+hora no header; sala/status/profissional dentro), salas, profissionais, relatórios

**Critério de aceite:** Profissional consegue fazer reserva completa no celular sem zoom nem scroll horizontal. ✅

---

## Sprint R6 — Notificações WhatsApp
**Status:** CONCLUÍDA (2026-06-22)
**Estimativa:** 1 semana

**Canal único:** WhatsApp via Z-API (cliente prefere WhatsApp; sem email na v1)

- [x] `api/src/services/notifications.ts` — `sendWhatsApp(phone, message)` fire-and-forget; nunca falha a request principal
- [x] `msgConfirmacao`, `msgCancelamento`, `msgLembrete` — templates de mensagem com parse manual de data (evita timezone)
- [x] Gatilho: `POST /reservations` → WhatsApp de confirmação ao profissional
- [x] Gatilho: `POST /reservations/:id/cancel` → WhatsApp de cancelamento ao profissional (admin e profissional)
- [x] `api/src/cron/reminders.ts` — cron diário às 8h (Brasília) via `node-cron`; busca reservas do dia seguinte e envia lembrete
- [x] Cron registrado em `server.ts` após app.listen(), passando `app.supabase`
- [x] Env vars documentadas em `.env.example`: `ZAPI_INSTANCE_ID`, `ZAPI_TOKEN`, `ZAPI_CLIENT_TOKEN`
- [ ] Configurar Z-API no painel (conectar número da clínica) — pendente: feito pelo cliente

**Critério de aceite:** Profissional reserva Sala 2 → recebe WhatsApp de confirmação em até 30 segundos. ✅ (requer Z-API configurada)

---

## Correções e polimento (pós-R6)
**Status:** CONCLUÍDO (2026-06-22)

Ajustes identificados durante uso real do sistema no celular:

### Dark mode — remoção definitiva
- [x] `tailwind.config.ts`: adicionado `darkMode: 'class'` — impede que `dark:` dispare via `prefers-color-scheme`. Sem ThemeToggle, dark mode nunca ativa.
- [x] `AppShell.tsx`: ThemeToggle removido; logos com `mix-blend-multiply` (fundo branco invisível sobre fundo claro)
- [x] `layout.tsx`: script anti-flash removido; `suppressHydrationWarning` no `<body>` (fix para extensão Grammarly)
- [x] Páginas `configuracoes` e `perfil`: removidas classes `dark:` — cards sempre brancos

### Correções de cards mobile
- [x] **Reservas (admin e profissional):** cabeçalho do card mostra apenas data+hora; sala/status/profissional aparecem ao expandir
- [x] **Salas:** número removido do cabeçalho mobile
- [x] **Profissionais:** só nome no cabeçalho; email/status/WhatsApp ao expandir
- [x] **Relatórios:** só nome no cabeçalho; tabs Semanal/Mensal em brand-600; rodapé sem "Total", valores por extenso em linhas separadas

### Bloqueios — UX mobile
- [x] Substituída tabela Hora × Sala (scroll horizontal impossível no celular) por:
  - Dois selects: Hora (07:00–21:00) e Sala
  - Painel de status grande abaixo com código de cores:
    - Verde / Disponível → botão "Bloquear este horário" (laranja)
    - Laranja / Bloqueado → motivo destacado + botão "Desbloquear" (vermelho)
    - Azul / Reservado → aviso informativo, sem ação
    - Cinza / Passado → aviso informativo, sem ação
  - Modais de confirmação compartilhados com desktop
  - Desktop: tabela grid original mantida intacta

---

## Sprint R7 — Deploy e entrega
**Status:** CONCLUÍDA (2026-06-22)
**Estimativa:** 1 semana

### Deploy produção ✅
- [x] Railway (API) configurado: root directory, build/start commands, env vars
- [x] Vercel (web) configurado: root directory, env vars, `vercel.json` para output detection
- [x] Supabase: migration v1 executada em produção (tabelas, RLS, seed)
- [x] Admin inserido manualmente após migration (ver NOTAS_TECNICAS.md)

### WhatsApp — migração Z-API → Baileys ✅
- [x] `api/src/services/whatsapp.ts` — Baileys embarcado na API (gratuito, sem serviço externo)
- [x] `api/src/services/notifications.ts` — `sendWA()` substituiu chamada HTTP para Z-API
- [x] `api/src/routes/whatsapp.ts` — `GET /whatsapp/status` e `POST /whatsapp/pair`
- [x] Painel admin: seção WhatsApp com QR Code e "Código pelo celular" (mobile-friendly)
- [x] `web/vercel.json` — fix para 404 no Vercel Edge (output directory explícito)
- [x] `web/src/middleware.ts` — try/catch para evitar 404 quando Supabase inacessível no Edge

### Entrega
- [ ] Sessão de walkthrough com a cliente (fluxo admin + profissional)
- [ ] Admin cadastra todos os profissionais, envia senhas via WhatsApp
- [ ] Treinamento: fazer reserva, cancelar, ver bloqueios, gerar relatório

**Critério de aceite:** Sistema no ar, cliente consegue operar sem assistência técnica.

---

## Sprint R8 — Notificações in-app
**Status:** Planejada
**Estimativa:** 1–2 dias

**Contexto:** WhatsApp serve apenas para envio de credenciais. Notificações operacionais (reservas, cancelamentos) acontecem dentro do próprio sistema.

### Quem recebe o quê
| Gatilho | Destinatário |
|---|---|
| Reserva criada (por qualquer um) | Profissional da reserva |
| Cancelamento feito pelo profissional | Admin(s) + confirmação ao profissional |
| Cancelamento feito pelo admin | Profissional da reserva |

### Banco
- [ ] Migration: tabela `notifications` (`id`, `user_id` FK, `type`, `title`, `body`, `read` DEFAULT false, `data` JSONB, `created_at`)
- [ ] RLS: usuário lê só as próprias; API insere via service_role
- [ ] `ALTER PUBLICATION supabase_realtime ADD TABLE notifications` (habilitar Realtime)

### API
- [ ] `api/src/services/inbox.ts` — `createNotification()` e `createNotificationsForAdmins()`
- [ ] `api/src/routes/notifications.ts` — `GET /notifications`, `PUT /notifications/:id/read`, `PUT /notifications/read-all`
- [ ] `api/src/routes/reservations.ts` — chamar inbox após `POST /reservations`
- [ ] `api/src/routes/cancellations.ts` — chamar inbox após cancel (lógica por role)
- [ ] `api/src/routes/index.ts` — registrar nova rota

### Frontend
- [ ] `web/src/components/NotificationBell.tsx` — sino com badge, dropdown, assinatura Supabase Realtime
- [ ] `web/src/components/AppShell.tsx` — sino no header mobile e sidebar desktop

**Critério de aceite:** Profissional faz reserva → vê notificação no sino. Profissional cancela → admin vê alerta no sino. Admin cancela → profissional vê aviso no sino.

---

## Resumo

| Sprint | Foco | Estimativa |
|---|---|---|
| R1 | Limpeza, schema novo, renomeação | 2–3 dias |
| R2 | Bloqueio de vagas (admin) | 2–3 dias |
| R3 | Cancelamento simplificado | 1 dia |
| R4 | Relatórios semanal + mensal | 2 dias |
| R5 | Mobile-first | 2–3 dias |
| R6 | Notificações WhatsApp | 1 semana |
| R7 | Deploy + entrega | 1 semana |
| R8 | Notificações in-app (sino + Realtime) | 1–2 dias |
| **Total** | | **~4–5 semanas** |

---

## Dependências

```
R1 (base)
  └── R2 (bloqueios — depende do availability atualizado)
  └── R3 (cancelamento — depende do schema novo)
  └── R4 (relatórios — depende do schema novo)
        └── R5 (mobile — pode começar em paralelo com R2/R3/R4)
              └── R6 (notificações — depende da API estável)
                    └── R7 (deploy — depende de tudo)
```

---

## Para v2 (fase futura)

- Pagamentos via Mercado Pago
- Repasses e splits financeiros
- Janela de cancelamento ampliada para 10h
- Cobrança por no-show
- Reembolso automatizado
