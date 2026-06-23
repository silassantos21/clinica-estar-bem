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

## CSS — Overflow e tooltips

`overflow-x: visible` e `overflow-y: auto` no **mesmo elemento** é inválido pelo spec CSS. O browser promove `visible` para `auto` silenciosamente, gerando barra de scroll horizontal inesperada em qualquer conteúdo absoluto que ultrapasse o container (ex: tooltips, dropdowns).

**Regra:**
- Container com filhos absolutos (tooltips, dropdowns) → **NÃO usar `overflow-hidden`** — ele clipa tudo que sair da bounding box, independente de `z-index`
- Scroll vertical → elemento interno separado com `overflow-y-auto`, nunca no mesmo wrapper dos absolutos
- Nunca misturar `visible` com `auto/scroll/hidden` no mesmo eixo

### Tooltips em tabelas

`overflow-hidden` no container da tabela clipa tooltips posicionados com `position: absolute`. `z-index` não resolve — ele não tem efeito sobre o clipping de overflow.

**Solução aplicada em `/admin/salas`:**
```tsx
// ❌ ERRADO — clipa tooltips
<div className="bg-white rounded-xl border border-gray-200 overflow-hidden">

// ✅ CORRETO — remove overflow-hidden; arredondamento vai pros th
<div className="bg-white rounded-xl border border-gray-200">
  <table>
    <thead>
      <tr>
        <th className="rounded-tl-xl ...">...</th>
        <th className="rounded-tr-xl ...">...</th>
```

Para o tooltip em si, usar Tailwind `group/tip` (named group) para evitar conflito com outros grupos:
```tsx
<div className="relative group/tip">
  <button>...</button>
  <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 ... opacity-0 group-hover/tip:opacity-100 transition-opacity">
    Tooltip text
  </span>
</div>
```

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
| `requireAdmin` | Rota exclusiva de admin. Profissional recebe 403. |
| `requireProfessional` | Rota exclusiva de profissional. Admin recebe 403. |
| `requireAuth` | Qualquer usuário autenticado; lógica de role **dentro** da rota. |

> Nota: o guard era `requirePsychologist` na v0. Renomeado para `requireProfessional` na Sprint R1.

### Regra: rotas mistas usam `requireAuth` com lógica interna

Se uma rota precisa de comportamentos diferentes por role (admin vê tudo, profissional vê só o próprio), usar `requireAuth` como `preHandler` e decidir dentro da função:

```typescript
// ✅ CORRETO
fastify.get('/reservations', { preHandler: requireAuth }, async (request, reply) => {
  if (authUser.role === 'professional') {
    query = query.eq('professional_id', authUser.professionalId)
  }
  // admin não filtra — vê tudo
})
```

### Antes de adicionar `requireAdmin` em qualquer rota nova

Verificar: alguma tela de profissional vai chamar esse endpoint? Se sim, usar `requireAuth` com verificação interna.

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

## Redirect loop pós-migration (tabela `users` zerada)

**Sintoma:** Login autentica com sucesso, mas entra em loop `GET / 307` no terminal da API.

**Causa:** A migration cria a tabela `users` do zero (via `DROP TABLE IF EXISTS`). O Supabase Auth (`auth.users`) não é apagado — a sessão do usuário permanece válida. Mas a tabela pública `users` fica vazia, então o middleware não encontra `role` → `redirect('/login')` → o middleware do Next.js detecta sessão ativa em `/login` → `redirect('/')` → loop.

**Solução:** Após rodar qualquer migration que recriar a tabela `users`, inserir o admin manualmente no Supabase SQL Editor:
```sql
INSERT INTO users (id, name, email, role)
VALUES ('<uuid-do-auth.users>', 'Admin', '<email>', 'admin');
```

O `id` é o UUID visível em Authentication → Users no painel do Supabase.

---

## Timezone — data local vs UTC nos slots de disponibilidade

**Sintoma:** Ao usar o wizard de reserva à noite (ex: 22h no Brasil, UTC-3), todos os horários aparecem com linha-through como "passados", mesmo em datas futuras.

**Causa:** `new Date().toISOString().split('T')[0]` retorna a data em UTC. No Brasil UTC-3, às 22h local o UTC já está no dia seguinte. Se `date` (estado) for inicializado com a data UTC e `todayStr` for calculado com a data local, eles divergem. Quando o usuário volta à data atual local, `date === todayStr` é `true` e `currentHour = 22` desabilita todos os slots das 7h às 21h.

**Solução:**
```typescript
// Helper que sempre retorna YYYY-MM-DD no fuso local
const localToday = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Usar em todos os lugares onde a "data de hoje" é necessária
const [date, setDate] = useState<string>(localToday)  // ← não usar toISOString()
const todayStr = localToday()
```

**Regra:** nunca usar `new Date().toISOString()` para obter a data local do usuário. `toISOString()` sempre retorna UTC.

---

## html2pdf.js — Geração de PDF no browser

### PDF em branco ao passar elemento off-screen

**Sintoma:** `html2pdf().from(container).save()` gera PDF em branco.

**Causa:** O html2canvas não consegue renderizar elementos fora do viewport (`position: absolute; left: -9999px`).

**Solução:** Passar a string HTML diretamente ao `.from()` — o html2pdf cria e posiciona o elemento internamente no viewport:
```ts
// ❌ ERRADO — off-screen não renderiza
const container = document.createElement('div')
container.style.cssText = 'position:absolute;left:-9999px'
container.innerHTML = html
document.body.appendChild(container)
await html2pdf().from(container).save()

// ✅ CORRETO — html2pdf gerencia o elemento no viewport
await html2pdf().set({ ... }).from(html).save()
```

### SVG inline não renderiza com html2canvas

**Sintoma:** `<svg>` com paths complexos aparece em branco no PDF gerado.

**Causa:** html2canvas tem suporte limitado a SVG inline — paths e elementos complexos não são renderizados.

**Solução:** Converter SVG para PNG via canvas antes de embutir como `<img>`:
```ts
const svgText = await fetch('/logo-icon.svg').then(r => r.text())
const pngDataUrl = await new Promise<string>((resolve) => {
  const blob = new Blob([svgText], { type: 'image/svg+xml' })
  const url = URL.createObjectURL(blob)
  const img = new Image()
  img.onload = () => {
    const canvas = document.createElement('canvas')
    canvas.width = 176; canvas.height = 176
    canvas.getContext('2d')!.drawImage(img, 0, 0, 176, 176)
    URL.revokeObjectURL(url)
    resolve(canvas.toDataURL('image/png'))
  }
  img.onerror = () => { URL.revokeObjectURL(url); resolve('') }
  img.src = url
})
// No HTML: <img src="${pngDataUrl}" width="88" height="88" />
```

`<img src="data:image/png;base64,...">` é renderizado corretamente pelo html2canvas.

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

---

## Tailwind CSS v3 — Dark Mode

### Comportamento padrão: media query, não desabilitado

**Sintoma:** Cores escuras (`bg-gray-900`, texto claro) aparecem na interface mesmo após remover `darkMode: 'class'` do config, quando o sistema operacional do usuário está em dark mode.

**Causa:** Em Tailwind v3, **sem `darkMode` no config, o default é `'media'`** (usa `@media (prefers-color-scheme: dark)`). Remover `darkMode: 'class'` não desativa o dark mode — apenas muda a estratégia de class para media query. Todos os `dark:*` continuam gerando CSS e disparando conforme o SO do usuário.

**Solução correta para desativar dark mode:**
```typescript
// tailwind.config.ts
const config: Config = {
  darkMode: 'class', // mantém estratégia por classe, mas nunca ativa
  // ...
}
```

Com `darkMode: 'class'`, os `dark:` só disparam quando alguém adicionar a classe `.dark` ao `<html>`. Se o ThemeToggle foi removido e nenhum script adiciona `.dark`, o dark mode nunca ativa — independente do SO do usuário.

> **Não existe `darkMode: false` no Tailwind v3.** A única forma de garantir que dark mode nunca dispara é usar `'class'` e nunca adicionar a classe.

### Classes `dark:` restantes no código são código morto inofensivo

Com `darkMode: 'class'` e sem toggle, as classes `dark:bg-gray-900`, `dark:text-gray-100` etc. existentes nos componentes geram CSS mas nunca são aplicadas. Podem ser limpas gradualmente ou deixadas — não causam problema visual.

---

## Supabase Realtime — Assinatura no frontend

Para escutar INSERTs em tempo real numa tabela (ex: `notifications`), usar `createBrowserClient` do `@supabase/ssr` (já disponível no projeto):

```typescript
// Client Component
const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
)

const channel = supabase
  .channel('notifications')
  .on(
    'postgres_changes',
    { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
    (payload) => { /* payload.new é o registro inserido */ },
  )
  .subscribe()

// Cleanup no useEffect return
return () => { supabase.removeChannel(channel) }
```

**Pré-requisitos:**
- Tabela com Realtime habilitado na migration: `ALTER PUBLICATION supabase_realtime ADD TABLE notifications;`
- RLS com policy SELECT para o usuário ler as próprias linhas; API insere via `service_role` (bypassa RLS)
- Filtro `filter: \`user_id=eq.${userId}\`` — necessário para que o Supabase aplique RLS no canal e o usuário receba apenas as próprias notificações

**Por que não usar polling?** Realtime entrega a notificação em ~200ms via WebSocket. Polling a cada 30s gera latência e queima requisições desnecessárias.

---

## CSS — SVG com fundo branco sobre fundo branco

**Problema:** Logos em SVG com fundo branco embutido ficam com retângulo branco visível quando o background da página também é branco/claro.

**Solução:** `mix-blend-multiply` faz o branco do SVG se fundir com o fundo branco da página, tornando-o invisível:
```tsx
<img src="/logo.svg" alt="Logo" className="h-14 w-auto mix-blend-multiply" />
```

Funciona apenas em backgrounds claros (branco, cinza claro). Em backgrounds escuros, `mix-blend-multiply` com branco resultaria em preto — mas como o sistema não tem dark mode, não é um problema.
