# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Silas Ribeiro dos Santos — MazyOS

> Operação da consultoria tecnológica do Silas. Aqui ficam todos os clientes, propostas, conteúdo e entregas.

**Estrutura de pastas:**
- `_memoria/` — quem é a consultoria, como falamos, foco atual
- `identidade/` — marca do Silas (aplicada nas peças internas)
- `clientes/` — uma subpasta por cliente, autossuficiente
- `briefings/` — briefings antes de virar cliente
- `propostas/` — propostas em andamento
- `marketing/` — conteúdo institucional
- `saidas/` — documentos pontuais, análises
- `dados/` — arquivos a analisar (relatórios de cliente, exports)
- `scripts/` — scripts e automações

## Sobre a consultoria

Silas entrega soluções tecnológicas sob medida para qualquer negócio — sites, sistemas, automações. Trabalha solo. Cliente ativo: Clínica Estar Bem (clínica de psicólogos).

## Clientes ativos

- **Clínica Estar Bem** — clínica de psicólogos. Pasta: `clientes/clinica-estar-bem/`

## O que mais produzimos aqui

- Propostas comerciais pra novos clientes
- Soluções e melhorias técnicas pra clientes
- Conteúdo de prospecção (emails, apresentações)

## Tom de voz

Direto, formal mas acessível. Vai ao ponto sem rodeios. Linguagem clara — se precisar explicar o que quis dizer, já tá errado. Assina com nome completo. Sem jargão técnico com cliente.

Evitar: texto difícil de entender, explicações que precisam de explicação.

## Regras do sistema

- Cliente novo → criar pasta `clientes/<Nome>/` com briefing, estratégia e subpastas conforme as entregas contratadas
- Proposta nova → `propostas/<cliente>-<data>.html` antes de fechar
- A identidade visual do cliente fica dentro da pasta dele, nunca misturar com a identidade do Silas
- Casos de sucesso ficam em `clientes/<Nome>/caso.md` (reuso em pitches)

## Ferramentas conectadas

- [ ] Gmail
- [ ] Google Calendar
- [ ] Google Ads
- [ ] Meta Ads

*(Marcar conforme for instalando os MCPs)*

---

## Contexto do negócio

No início de toda conversa, ler os seguintes arquivos (quando existirem e estiverem preenchidos):

1. `_memoria/empresa.md` — quem é o Silas, o que faz, como funciona a consultoria
2. `_memoria/preferencias.md` — tom de voz, estilo de escrita, o que evitar
3. `_memoria/estrategia.md` — foco atual, prioridades, prazos

Usar essas informações como base pra qualquer resposta ou decisão. Ao sugerir prioridades, formatos ou abordagens, considerar o foco atual descrito em `estrategia.md`.

Pra qualquer tarefa visual (carrossel, post, landing page), consultar `identidade/design-guide.md` como referência de estilo.

Não é necessário listar o que foi lido nem confirmar a leitura. Apenas usar o contexto naturalmente.

---

## Skills disponíveis

Todas as skills ficam em `.claude/skills/<nome>/SKILL.md`. Antes de executar qualquer tarefa, verificar se existe skill relevante. Se encontrar, seguir as instruções da skill.

| Skill | Quando invocar |
|---|---|
| `/abrir` | Início de sessão — carrega memória e devolve resumo |
| `/salvar` | Commit + push no GitHub (backup do trabalho) |
| `/atualizar` | Varre o projeto e atualiza a memória com o que mudou |
| `/novo-projeto` | Criar pasta isolada pra novo cliente ou iniciativa |
| `/mapear-rotinas` | Descobrir o que se repete e transformar em skill |
| `/carrossel` | Criar carrossel ou post visual pra Instagram/redes (HTML + PNG 1080×1350 via Playwright) |
| `/publicar-tema` | Pipeline completo: artigo de blog + carrossel + 3 legendas (Insta, FB, LinkedIn) a partir de um tema |
| `/aprovar-post` | Publicar conteúdo aprovado: flipa draft, push, deploy, posta via Meta API |
| `/seo` | Fluxo completo de SEO + GEO + Google Ads em 8 passos |
| `/anuncio-google` | Monta campanha em CSV pronto pro Google Ads Editor |
| `/relatorio-ads` | Lê exports de Google + Meta e gera relatório semanal |
| `/analisar-dados` | Lê CSV/XLSX/PDF e gera resumo executivo |
| `/email-profissional` | Rascunha email a partir de contexto livre |
| `/responder-avaliacoes` | Escreve respostas pras avaliações do Google |
| `/instalar` | Roda uma vez só — entrevista e configura o sistema |

---

## Pipeline de conteúdo

O fluxo completo de produção de conteúdo conecta as skills nessa ordem:

```
/seo  →  /publicar-tema  →  /carrossel  →  /aprovar-post
(pesquisa)   (blog + carrossel)   (visual PNG)   (publica)
```

- `/seo` gera `marketing/seo/05-estrategia-conteudo.md` — lista mestra de temas
- `/publicar-tema` consome essa lista, escreve o blog e chama `/carrossel` internamente
- Todo blog começa com `draft: true`; só flipa pra `false` via `/aprovar-post`
- Outputs de marketing ficam em `marketing/conteudo/<tipo>-<tema>-<YYYY-MM-DD>/`

---

## Notas técnicas (lições de produção)

Antes de debugar qualquer problema de build, deploy, env ou Windows: ler `clientes/clinica-estar-bem/sistema/NOTAS_TECNICAS.md`. Contém soluções já testadas para:
- Binários npm no Windows (tsx.cmd, caminhos com espaços)
- dotenv não carregado pelo tsx
- WebSocket no Node 20 (ws obrigatório)
- dist corrompido/sumindo
- SSR + autenticação no Next.js
- RLS e diferença de keys no Supabase
- **Tailwind v3 dark mode:** sem `darkMode: 'class'`, o default é media query (dispara pelo SO). Usar sempre `darkMode: 'class'` para desativar efetivamente.
- SVG com fundo branco: usar `mix-blend-multiply` ao invés de editar o SVG
- Hydration warning de extensões (Grammarly): `suppressHydrationWarning` no `<body>`
- html2pdf.js: SVG não renderiza — converter para PNG via canvas antes

---

## Pré-requisitos técnicos

**Carrosséis (renderização de PNG):**
- Node.js instalado
- Playwright: cada pasta de carrossel tem seu próprio `render.js`
- Reutilizar `node_modules` de pastas anteriores quando possível: `NODE_PATH="<pasta>/node_modules" node render.js`

**Publicação automática (`/aprovar-post`):**
- `.env` na raiz com: `META_PAGE_ACCESS_TOKEN`, `META_PAGE_ID`, `META_IG_USER_ID`, `SITE_URL`
- Site com deploy automático a partir do `main` (Netlify ou Vercel)
- Conta Instagram Business conectada à Página Facebook
- Scripts `scripts/postar-instagram.js` e `scripts/postar-facebook.js`

---

## Fluxo de trabalho

Ao concluir uma tarefa que não tinha skill mas parece repetível, perguntar:

> "Isso pode virar uma skill pra próxima vez. Quer que eu crie?"

Não perguntar pra tarefas pontuais ou perguntas simples. Só quando o padrão de repetição for claro.

---

## Aprender com correções

Quando o Silas corrigir algo, melhorar uma resposta ou dar uma instrução que parece permanente, perguntar:

> "Quer que eu salve isso pra não precisar repetir?"

Se sim, identificar onde faz mais sentido salvar:

- **Sobre o negócio** → `_memoria/empresa.md`
- **Sobre preferências e estilo** → `_memoria/preferencias.md`
- **Sobre prioridades e foco** → `_memoria/estrategia.md`
- **Regra de comportamento nessa pasta** → próprio `CLAUDE.md`

---

## Manter contexto atualizado

Ao terminar uma tarefa que mudou algo relevante, perguntar:

> "Isso mudou algo no teu contexto. Quer que eu atualize a memória?"

Se sim, identificar o que atualizar e mostrar o que vai mudar antes de salvar.

**Quando NÃO perguntar:** tarefas pontuais sem impacto no contexto, perguntas simples.

---

## Criação de skills

Quando o Silas pedir skill nova:

1. Verificar se existe template relevante em `templates/skills/`
2. Perguntar se é específica desse projeto ou útil em qualquer:
   - Específica → `.claude/skills/nome-da-skill/SKILL.md` (local)
   - Universal → `~/.claude/skills/nome-da-skill/SKILL.md` (global)
3. Ler `_memoria/empresa.md` e `_memoria/preferencias.md` pra calibrar o conteúdo ao contexto
4. Seguir o fluxo da skill-creator nativa do Claude Code
