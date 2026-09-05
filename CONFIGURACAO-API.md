# Onde configurar banco e PantePay

## Local das variáveis

No painel do projeto, abra:

**Settings → Secrets / Environment Variables**

Adicione:

```text
DATABASE_URL=connection-string-postgresql-do-supabase
PANTEPAY_API_URL=https://endpoint-oficial-da-pantepay
PANTEPAY_SECRET_KEY=chave-secreta-da-pantepay
PANTEPAY_WEBHOOK_SECRET=segredo-do-webhook
```

Não coloque esses valores no React, em `client/src`, em `VITE_*`, no HTML ou no Git.

## Arquivos backend

| Arquivo | Função |
| --- | --- |
| `server/_core/env.ts` | Lê `DATABASE_URL` e as três variáveis `PANTEPAY_*` do ambiente. |
| `server/db.ts` | Abre a conexão PostgreSQL usando `DATABASE_URL` e grava pedidos. |
| `server/pantepay.ts` | Ponto central da configuração server-side da PantePay. |
| `server/routers.ts` | Fluxo do pedido; será o ponto que chamará a PantePay quando o endpoint oficial for confirmado. |
| `server/_core/index.ts` | Ponto para registrar webhook, caso a PantePay forneça callback oficial. |
| `drizzle/schema.ts` | Estrutura das tabelas do banco. |

A API real ainda não foi chamada porque faltam o endpoint oficial, payload e formato da assinatura da PantePay. O módulo `server/pantepay.ts` já deixa o local preparado e falhará de forma explícita se `PANTEPAY_API_URL` ou `PANTEPAY_SECRET_KEY` não estiverem configuradas. A migração PostgreSQL foi gerada em `drizzle-pg/0000_public_cable.sql`; aplique-a somente depois de cadastrar a `DATABASE_URL` real do Supabase.
