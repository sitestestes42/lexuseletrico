# Configuração rápida

## 1. Supabase

No Vercel, configure `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` e `DATABASE_URL`.

No Supabase, ative **Authentication → Providers → Email**.

Se necessário, rode `drizzle-pg/0000_public_cable.sql` no SQL Editor.

## 2. PantePay

Configure `PANTEPAY_API_URL`, `PANTEPAY_SECRET_KEY` e `PANTEPAY_WEBHOOK_SECRET` somente no Vercel.

A integração de cobrança permanece desativada até o contrato oficial da API ser confirmado.
