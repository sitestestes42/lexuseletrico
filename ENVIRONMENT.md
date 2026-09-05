# Variáveis de ambiente — Vercel

Configure em **Settings → Environment Variables**. Para login + pedidos, as três primeiras variáveis essenciais são `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` e `DATABASE_URL`:

```text
SUPABASE_URL=
SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
DATABASE_URL=
PANTEPAY_API_URL=
PANTEPAY_SECRET_KEY=
PANTEPAY_WEBHOOK_SECRET=
```

## Exposição

Configuração pública:
- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `PANTEPAY_API_URL` (desde que o provedor trate a URL como pública)

Segredos — backend apenas:
- `SUPABASE_SECRET_KEY`
- `DATABASE_URL`
- `PANTEPAY_SECRET_KEY`
- `PANTEPAY_WEBHOOK_SECRET`

A V3 não usa `VITE_OAUTH_PORTAL_URL`, `OAUTH_SERVER_URL`, `JWT_SECRET`, `BUILT_IN_FORGE_API_URL` nem `BUILT_IN_FORGE_API_KEY`.

`SUPABASE_SECRET_KEY` não é necessária para o login da V3; ela pode permanecer cadastrada para futuras operações administrativas server-side.
