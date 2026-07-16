# js-lab

Laboratório de IA para atendimento WhatsApp. Sistema de agentes conversacionais com sugestão de resposta em tempo real, aprendizado por divergência e refinamento assistido por IA.

## Stack

- Next.js 15.2.4 · React 19 · TypeScript
- PostgreSQL via `pg` (sem ORM)
- Anthropic SDK `@anthropic-ai/sdk` ^0.80.0
- Evolution API para WhatsApp

## Comandos

```bash
npm run dev      # porta 3000
npm run build
npm run lint
```

## Banco de dados

Schema `lab.*` para tudo do laboratório. Schema `public.*` para dados IPTV (clientes, assinaturas, planos — só leitura aqui).

Tabelas principais:
- `lab.agentes` — cadastro dos agentes (`prompt_base`, `prompt_atual`, `ativo`, `analisado_ate`)
- `lab.agente_instancias` — vínculo agente ↔ instância WhatsApp (1 instância = 1 agente ativo)
- `lab.agente_modulos` — blocos de conhecimento com `gatilhos[]`, `conteudo`, `ordem`, `ativo`
- `lab.agente_prompt_versoes` — histórico versionado de prompts
- `lab.agente_aprendizados` — divergências sugestão IA vs resposta real (`tipo`: correcao/lacuna/insight)
- `lab.messages` — mensagens WhatsApp (`jid`, `from_me`, `content`, `message_type`, `timestamp`, `raw`)

## Regra crítica: alteração de prompt

**Nunca fazer UPDATE direto em `lab.agentes.prompt_atual`.**  
Sempre usar `POST /api/agentes/[id]/prompt` — ele atualiza o campo E cria registro em `lab.agente_prompt_versoes` automaticamente.

## Fluxo de sugestão

`POST /api/chat/sugestao` → busca agente pela instância → carrega prompt_atual → filtra módulos pelos gatilhos → busca contexto do cliente IPTV → chama `claude-sonnet-4-6` (max 400 tokens) → retorna `{raciocinio, resposta}` (raciocinio é interno, não vai ao cliente).

## Fluxo de aprendizado

`POST /api/chat/aprendizado` → acionado quando usuário envia resposta diferente da sugestão → Claude classifica (correcao/lacuna/insight) → salva em `lab.agente_aprendizados` com `incorporado = false`.

## Fluxo de refinamento

`/app/agentes/[id]` → aba "Chat de refinamento". Histórico persistido no banco. Claude analisa prompt atual + módulos + últimas 40 mensagens da conversa real. Sugere via marcadores:
- `<<<PROMPT_ATUALIZADO>>>..<<<FIM_PROMPT>>>`
- `<<<MODULO>>>..<<<FIM_MODULO>>>`

Usuário aprova/descarta na UI.

## Variáveis de ambiente necessárias

```
ANTHROPIC_API_KEY
EVOLUTION_URL
EVOLUTION_KEY
DATABASE_URL       # ou variáveis pg individuais
GOOGLE_CLIENT_ID    # client OAuth compartilhado com o js-painel
GOOGLE_CLIENT_SECRET
AUTH_SECRET
```

## Autenticação

Login via Google (next-auth v5, `auth.ts` na raiz), restrito a `js9jonas@gmail.com` (uso individual — sem tabela de usuários no banco, checagem hardcoded no callback `signIn`). Proteção centralizada em `middleware.ts`, cobrindo todo o app por padrão (substituiu a Basic Auth emergencial de 13/07, após o incidente do cryptominer). Rotas isentas (chamadas por serviços externos sem sessão): `/api/webhook`, `/api/evolution/webhook`, `/api/coex/activate`, `/api/alexa`.

## Modelo em uso

`claude-sonnet-4-6` em todas as rotas (sugestão, aprendizado, refinamento, análise-multi).
