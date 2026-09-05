# Lexus Elétricos — V3

Versão preparada para Vercel com:

- React + Vite no frontend
- Express + tRPC em Vercel Functions
- Supabase Auth por e-mail/senha
- PostgreSQL do Supabase via Drizzle
- pedidos com recálculo server-side e idempotência
- PantePay mantida como integração backend pendente do contrato oficial da API

## Vercel

Mantenha:

- Framework Preset: `Vite`
- Output Directory: `dist/public`
- Root Directory: `./`

Variáveis usadas agora:

```text
SUPABASE_URL
SUPABASE_PUBLISHABLE_KEY
DATABASE_URL
```

Variáveis mantidas para integrações backend/futuras:

```text
SUPABASE_SECRET_KEY
PANTEPAY_API_URL
PANTEPAY_SECRET_KEY
PANTEPAY_WEBHOOK_SECRET
```

`SUPABASE_SECRET_KEY`, `DATABASE_URL`, `PANTEPAY_SECRET_KEY` e `PANTEPAY_WEBHOOK_SECRET` devem permanecer secretas.

## Supabase Auth

Ative o provedor **Email** no painel do Supabase e, em **Authentication → URL Configuration**, defina o Site URL como o domínio de produção (por exemplo `https://lexuseletrico.vercel.app`). O frontend usa `/entrar`, mas as credenciais são enviadas ao backend `/api/auth/*`; os tokens do Supabase ficam em cookies `HttpOnly`, e não em `localStorage`.

Se a confirmação de e-mail estiver ativada no Supabase, o cadastro informa ao usuário que ele precisa confirmar antes de entrar.

## Banco

Se ainda não aplicou as tabelas, execute no SQL Editor do Supabase:

`drizzle-pg/0000_public_cable.sql`

O login funciona mesmo antes da migração; porém a criação de pedidos precisa das tabelas `users`, `orders` e `order_items`.

## Testes rápidos depois do deploy

1. `/api/health` deve retornar JSON com `ok: true`.
2. `/api/trpc/auth.me?batch=1&input=...` não deve mais derrubar a Function; sem login, retorna sessão vazia.
3. Acesse `/entrar`, crie uma conta ou faça login.
4. Abra `/checkout` e confirme que o usuário está autenticado.
