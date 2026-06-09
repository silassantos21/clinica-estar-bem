# Notas Técnicas — Lições aprendidas

> Problemas reais encontrados em produção ou desenvolvimento. Consultar antes de debugar.

---

## Windows + Node.js — Armadilhas

### Binários npm no PowerShell
Nunca chamar binários de `node_modules/.bin/` diretamente com `node`:
```powershell
# ❌ ERRADO — tsx é um .cmd no Windows, não um módulo Node
node node_modules/.bin/tsx src/server.ts

# ✅ CORRETO — npm resolve o .cmd automaticamente
npm run dev
```

### Caminhos com espaços
O projeto está em `Clínica Estar Bem` (espaços no caminho). Algumas ferramentas CLI falham silenciosamente. Sempre usar `Set-Location` explícito no PowerShell antes de rodar qualquer comando.

---

## Variáveis de Ambiente

### tsx / ts-node não carregam .env automaticamente
Solução aplicada: importar `dotenv` como **primeira linha** do entry point.

```typescript
// src/server.ts
import 'dotenv/config'   // ← deve ser a primeira linha, antes de qualquer outro import
import { buildApp } from './app.js'
```

Alternativa para produção com `node` puro (Node 20.6+):
```bash
node --env-file=.env dist/server.js
```
Mas **não funciona** passando para tsx/ts-node — esses são batch files no Windows.

---

## Node.js 20 — WebSocket

Node 20 não tem WebSocket nativo (foi adicionado no Node 22). O `@supabase/realtime-js` exige WebSocket no construtor e lança erro mesmo se realtime nunca for usado.

**Solução aplicada:**
```bash
npm install ws @types/ws
```
```typescript
import ws from 'ws'
createClient(url, key, {
  realtime: { transport: ws }
})
```

---

## Build — dist corrompido ou sumindo

Se o servidor subir sem erros mas se comportar de forma inesperada, ou se o build rodar sem gerar arquivos:

```powershell
Remove-Item -Recurse -Force dist -ErrorAction SilentlyContinue
npm run build
```

Para verificar se o build realmente gerou arquivos:
```powershell
Test-Path ".\dist\server.js"
```

---

## Next.js — SSR e autenticação

### Não usar localStorage em Server Components
Server Components rodam no servidor — não há `window`, `localStorage` ou cookies de sessão disponíveis ali. Tudo que depende do estado do usuário autenticado deve estar em:
- Client Components (`'use client'`)
- Middleware do Next.js (que tem acesso a cookies via `request`)
- Server Components que leem cookies via `cookies()` do `next/headers`

### Middleware protege rotas, não a página raiz diretamente
O `middleware.ts` roda antes de qualquer render. Redirecionar usuário não autenticado antes de chegar no componente.

### Hydration mismatch — estado inicial do layout
Nunca inicializar estado de layout (ex: sidebar aberta/fechada) com valor do `localStorage` direto. O servidor renderiza com o default e o cliente hidrata com o valor salvo — os dois diferem, causando mismatch visual.

**Correto:** sempre começar com valor fixo no `useState` / `useRef`. Atualizar com localStorage só depois do mount (`useEffect`).

---

## CSS — Overflow

`overflow-x: visible` e `overflow-y: auto` no **mesmo elemento** é inválido pelo spec CSS. O browser promove `visible` para `auto` silenciosamente, gerando barra de scroll horizontal inesperada em qualquer conteúdo absoluto que ultrapasse o container (ex: tooltips, dropdowns).

**Regra:**
- Container com filhos absolutos → `overflow-hidden`
- Scroll vertical → elemento interno separado com `overflow-y-auto`
- Nunca misturar `visible` com `auto/scroll/hidden` no mesmo eixo

---

## Deploy — Produção vs Desenvolvimento

| Comando | Quando usar |
|---|---|
| `npm run dev` | Desenvolvimento — sem dist, hot reload |
| `npm run build` | Gera dist para produção |
| `npm run start` | Produção — executa dist compilado |

**Nunca rodar `start` em desenvolvimento** — executa código compilado (possivelmente desatualizado).

**Boa prática:** adicionar `prestart` no `package.json` que roda `build` antes do `start`, evitando dist stale em produção:
```json
"prestart": "npm run build",
"start": "node dist/server.js"
```

---

## Rollup / Bundler — Tree-shaking agressivo (deploy)

Em alguns bundlers (Rollup usado pelo Nitro/Vercel), funções anotadas com `@__PURE__` ou `@__NO_SIDE_EFFECTS__` podem ser eliminadas mesmo sendo necessárias em runtime. Sintoma: funciona em dev, quebra em produção com erro de "instance unavailable" ou função undefined.

Se isso acontecer, desabilitar tree-shaking de anotações no bundler ou verificar o bundle gerado manualmente.

---

## Supabase — RLS e service_role

- `anon key`: exposta no frontend. Acesso limitado pelas policies do RLS.
- `service_role key`: **nunca expor no frontend**. Bypassa RLS. Usar apenas na API server-side.
- Tabela com RLS ativo sem nenhuma policy = negação total para anon/user. Correto para tabelas que só a API deve acessar.
- Testar conexão via REST sem instanciar o cliente JS (evita problema do WebSocket):
```js
fetch(`${SUPABASE_URL}/rest/v1/${tabela}?select=*`, {
  headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` }
})
```

---

## API — Autorização por role (guards nas rotas)

### Padrão correto de guards

Três guards disponíveis em `api/src/middlewares/guards.ts`:

| Guard | Quando usar |
|---|---|
| `requireAdmin` | Rota exclusiva de admin. Psicólogo recebe 403. |
| `requirePsychologist` | Rota exclusiva de psicólogo. Admin recebe 403. |
| `requireAuth` | Qualquer usuário autenticado; lógica de role **dentro** da rota. |

### Regra: rotas mistas usam `requireAuth` com lógica interna

Se uma rota precisa de comportamentos diferentes por role (admin vê tudo, psicólogo vê só o próprio), usar `requireAuth` como `preHandler` e decidir dentro da função:

```typescript
// ✅ CORRETO
fastify.get('/reservations', { preHandler: requireAuth }, async (request, reply) => {
  if (authUser.role === 'psychologist') {
    query = query.eq('psychologist_id', authUser.psychologistId)
  }
  // admin não filtra — vê tudo
})
```

### Erro que já aconteceu: `requireAdmin` numa rota que psicólogo precisa acessar

**Rota afetada:** `GET /psychologists/:id/rooms`

**Sintoma:** 403 "Acesso restrito ao administrador" ao entrar no wizard de nova reserva como psicólogo.

**Causa:** A rota estava com `requireAdmin`, mas o wizard chama `GET /psychologists/:psychologistId/rooms` para carregar as salas com tarifa efetiva do psicólogo.

**Solução aplicada:** Trocar para `requireAuth` com verificação de propriedade:
```typescript
// Psicólogo acessa apenas o próprio ID; admin acessa qualquer
if (authUser.role !== 'admin' && authUser.psychologistId !== id) {
  return reply.status(403).send({ error: 'Sem permissão para acessar este recurso' })
}
```

### Antes de adicionar `requireAdmin` em qualquer rota nova

Verificar: alguma tela de psicólogo vai chamar esse endpoint? Se sim, usar `requireAuth` com verificação interna.

---

## API — Cálculo de end_at para reservas de 1h

### Bug: substring inclui separador de minutos

**Sintoma:** Postgres rejeita com `invalid input syntax for type timestamp with time zone: "2026-06-15T08:09:00:00"`.

**Causa:** `start_at.substring(0, 14)` em `"2026-06-15T08:00:00"` resulta em `"2026-06-15T08:"` (14 chars, inclui o `:` dos minutos). Concatenar hora+1 = `"08:" + "09" + ":00:00"` = `"08:09:00:00"` — inválido.

**Solução:** Parsear hora direto da string e reconstruir sem depender de `Date.getHours()` (que também sofre conversão de timezone):
```typescript
// ❌ ERRADO
const end_at = `${start_at.substring(0, 14)}${String(startDate.getHours() + 1).padStart(2, '0')}:00:00`

// ✅ CORRETO
const startHour = parseInt(start_at.substring(11, 13), 10)
const end_at = `${start_at.substring(0, 11)}${String(startHour + 1).padStart(2, '0')}:00:00`
// "2026-06-15T" + "09" + ":00:00" = "2026-06-15T09:00:00" ✓
```

Regra: ao manipular timestamps sem timezone como string, usar `substring(0, 11)` para pegar apenas `"YYYY-MM-DDT"`.

---

## Next.js — Hydration warning por extensões de browser

**Sintoma:** Warning `Extra attributes from the server: data-new-gr-c-s-check-loaded, data-gr-ext-installed` no console — gerado pela extensão Grammarly injetando atributos no `<body>` do DOM.

**Solução:** `suppressHydrationWarning` no `<html>` e `<body>` do root layout:
```tsx
// app/layout.tsx
<html lang="pt-BR" suppressHydrationWarning>
  <body className="..." suppressHydrationWarning>
```

Isso instrui o React a ignorar diferenças de atributos nesse elemento durante hydration, sem afetar os filhos.

---

## Mercado Pago — Sandbox e testes

### Cartões de teste vencem
Os cartões de teste documentados pelo MP (ex: vencimento `11/25`) ficam vencidos com o tempo. No sandbox, qualquer data futura funciona — usar `11/30` ou `12/28`.

### ERR_TOO_MANY_REDIRECTS no sandbox
O `sandbox.mercadopago.com.br` entra em loop de redirect quando há cookies conflitantes no browser. Solução: abrir em aba anônima nova e limpar cookies do domínio `sandbox.mercadopago.com.br` antes de acessar.

### "Uma das partes é de teste"
Erro ao tentar pagar no checkout sandbox com conta real do MP. O sandbox exige que **vendedor** (token) e **comprador** (quem paga) sejam ambos contas de teste. Criar conta de comprador teste no painel MP → Contas de teste.

### `auto_return` rejeita back_urls com localhost
O campo `auto_return: 'approved'` exige `back_urls.success` com URL pública. Em dev o `FRONTEND_URL=http://localhost:3000` é rejeitado pelo MP. **Solução:** removido `auto_return` e `back_urls` da preference; adicionar apenas em produção.

### Endpoint de teste para simular pagamento aprovado
Em dev, usar `POST /reservations/:id/confirm-test` para confirmar reserva sem passar pelo checkout. Disponível apenas em `NODE_ENV=development`. Simula o que o webhook faria ao receber pagamento aprovado. O botão `[dev] confirmar` aparece na lista de reservas do psicólogo em dev.

### ngrok muda URL a cada reinício (plano free)
Sempre que reiniciar o ngrok, atualizar em dois lugares:
1. `API_PUBLIC_URL` em `api/.env`
2. URL do webhook no painel do MP (mercadopago.com.br/developers/panel → sua app → Webhooks)

---

## Fluxo de Ausência (no-show)

### Como uma ausência é gerada

O sistema **não exige ação manual** do admin para registrar uma ausência. O fluxo é:

1. Reserva fica `confirmed` (pagamento confirmado)
2. Horário da sessão passa sem o admin marcar como concluída
3. O **pg_cron** (Supabase, a cada 15 min) detecta `confirmed` com `end_at < NOW()`
4. Automaticamente: status → `no_show`, pagamento → `retained`, repasse criado com `penalty_split_rate`

### O admin tem duas ações possíveis ao final de cada sessão

| Ação | Como fazer | Resultado |
|---|---|---|
| Sessão aconteceu normalmente | Modal da reserva → "Confirmar sessão concluída" | Status `completed`, repasse pelo valor integral |
| Paciente não compareceu | Não fazer nada | Cron marca como `Ausência` automático, pagamento retido, repasse pelo split |

### Testar sem esperar o cron

Rodar o SQL manualmente no Supabase SQL Editor (mesmo lógica do cron):
```sql
-- Verificar o que seria processado
SELECT r.id, r.status, r.end_at FROM reservations r
WHERE r.status = 'confirmed' AND r.end_at < NOW();
```

Ou chamar o endpoint manual (requer `CRON_SECRET` no header):
```bash
curl -X POST http://localhost:3001/cron/no-show \
  -H "Authorization: Bearer <CRON_SECRET>"
```

### Nomenclatura

- Valor no banco/API: `no_show` (imutável — base de dados e integrações dependem disso)
- Exibição no frontend: **"Ausência"** (alterado em 2026-06-08; antes era "No-show")

---

## Next.js + Supabase SSR — Problemas de sessão pós-login

### Redirect loop após login

**Sintoma:** Login autentica com sucesso (rede mostra 200 no auth), mas a página volta pro `/login` em loop.

**Causa:** `router.push('/')` faz navegação RSC interna do Next.js. A request RSC pode não incluir o cookie de sessão recém-gravado pelo `createBrowserClient`, então o middleware/servidor não encontra usuário → redireciona de volta.

**Solução:**
```typescript
// ❌ ERRADO — navegação RSC, cookie pode não ser enviado
router.push('/')
router.refresh()

// ✅ CORRETO — navegação HTTP completa, todos os cookies são enviados
window.location.href = '/'
```

### Arquivos estáticos passando pelo middleware de auth

**Sintoma:** Imagens em `public/` (logo.svg, etc.) aparecem quebradas no browser.

**Causa:** O middleware de auth roda para todos os paths que casam com o matcher. Se `/logo.svg` casa, o middleware verifica autenticação e redireciona → browser recebe redirect ao invés do SVG.

**Solução** — excluir extensões de arquivo estático do matcher:
```typescript
// middleware.ts
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$|api).*)'],
}
```
