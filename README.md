# JS Laboratório

Laboratório de ferramentas, automações e integrações — JS Sistemas.

## Stack
- Next.js 15 (App Router, TypeScript)
- PostgreSQL (mesmo banco do js-painel, schema separado via tabela `lab_*`)
- Evolution API (WhatsApp)

## Setup local

```bash
# 1. Instalar dependências
npm install

# 2. Copiar e preencher variáveis de ambiente
cp .env.example .env.local

# 3. Criar tabela de log no banco
node -e "require('./lib/db').runMigrations()"

# 4. Rodar em desenvolvimento (porta 3002)
npm run dev
```

Acesse: http://localhost:3002

## Configurar webhook na Evolution API

No painel da Evolution API, configure o webhook da instância `jsevolution`:

- **URL:** `https://js-lab.seudominio.com/api/webhook`
- **Eventos:** `messages.upsert` (o resto pode desativar)
- **Header:** `x-webhook-secret: <valor do WEBHOOK_SECRET no .env>`

## Arquivos para apagar no js-painel

```
js-painel/app/evolution/page.tsx
js-painel/app/api/evolution/[...path]/route.ts
js-painel/app/api/evolution/          ← pasta inteira
```

## Estrutura

```
js-lab/
├── app/
│   ├── api/
│   │   ├── webhook/route.ts          ← entrada Evolution API
│   │   ├── evolution/[...path]/      ← proxy Evolution (dashboard)
│   │   └── lab/
│   │       ├── simulate/route.ts     ← simulador da interface
│   │       └── logs/route.ts         ← leitura de logs
│   ├── layout.tsx
│   └── page.tsx                      ← dashboard do lab
├── lib/
│   ├── types.ts                      ← tipos compartilhados
│   ├── classifier.ts                 ← classifica mensagens recebidas
│   ├── dispatcher.ts                 ← roteia para o handler correto
│   ├── evolution.ts                  ← cliente da Evolution API
│   ├── db.ts                         ← PostgreSQL
│   └── handlers/
│       ├── comprovante-pix.ts        ← OCR + resposta automática
│       └── comando.ts                ← /info, /status, /ajuda
```

## Deploy no Easypanel

1. Criar novo serviço → App → GitHub → repo `js-lab`
2. Configurar variáveis de ambiente (mesmo `.env.example`)
3. **Porta:** 3002
4. Auto-deploy: branch `main`

## Adicionar um novo handler

1. Criar `lib/handlers/meu-handler.ts` exportando `handleMeuHandler(payload, dryRun)`
2. Adicionar o tipo em `lib/types.ts` → `MessageKind`
3. Adicionar a regra de detecção em `lib/classifier.ts` → `PATTERNS`
4. Registrar no `lib/dispatcher.ts` → `switch(kind)`
5. Testar pelo simulador em `localhost:3002`
