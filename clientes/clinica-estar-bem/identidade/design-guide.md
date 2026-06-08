# Identidade Visual — Clínica Estar Bem

## Arquivos de logo

| Arquivo | Uso |
|---|---|
| `sistema/web/public/logo.svg` | Logo completa (marca + nome) |
| `sistema/web/public/logo-icon.svg` | Só o símbolo (espiral) |

## Paleta de cores

### Cor principal — Rosa magenta
Extraída do texto e elementos primários da logo.

| Token | Hex | Uso |
|---|---|---|
| `brand-600` | `#C01C63` | Botões primários, links, estado ativo da nav |
| `brand-700` | `#9A1450` | Hover em botões |
| `brand-50`  | `#FEF1F6` | Background de item ativo na sidebar |
| `brand-100` | `#FBDAEC` | Fundo de alertas, badges suaves |

### Cor secundária — Verde sálvia
Extraída da espiral decorativa da logo.

| Token | Hex | Uso |
|---|---|---|
| `sage-400` | `#8EA6A0` | Acentos, badges de status neutro |
| `sage-50`  | `#F0F4F3` | Fundo de painéis secundários |

### Neutros (sistema)
Sistema usa `gray-*` do Tailwind como base — não customizar.

## Linguagem visual

- **Estética:** saúde e bem-estar — acolhedor, profissional, limpo
- **Forma:** orgânica (a espiral da logo transmite fluidez e cuidado)
- **Tom:** magenta é quente e confiante; sálvia é calmante e equilibrado
- **Tipografia:** Inter (padrão Next.js) — sem serifa, moderna
- **Ícones:** se necessário, usar Lucide React (peso regular)
- **Bordas:** `rounded-lg` (8px) para cards e inputs; `rounded-xl` (12px) para modais e painéis

## Regras de aplicação

- Botão primário: `bg-brand-600 hover:bg-brand-700 text-white`
- Botão secundário: `border border-gray-200 text-gray-700 hover:bg-gray-50`
- Input focus: `focus:ring-2 focus:ring-brand-600/20 focus:border-brand-600`
- Nav ativa: `bg-brand-50 text-brand-600 font-medium`
- Nav inativa: `text-gray-600 hover:bg-gray-100`
- Badge positivo (ativo/confirmado): `bg-green-50 text-green-700`
- Badge negativo (inativo/cancelado): `bg-gray-100 text-gray-500`
- Badge alerta: `bg-brand-50 text-brand-600`

## O que NÃO usar

- Azul (`blue-*`) — cor padrão do Tailwind, não é da marca
- Gradientes — a marca é plana e limpa
- Sombras pesadas — preferir `shadow-sm` ou `border` no lugar de `shadow-xl`
