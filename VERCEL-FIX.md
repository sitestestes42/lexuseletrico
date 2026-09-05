# Ajuste para Vercel

Este projeto usa Vite no frontend e Express + tRPC no backend.

## O que foi adicionado

- `api/index.ts`: expõe o backend existente como Vercel Function.
- `vercel.json`: envia `/api/*` para o backend e mantém o fallback SPA do Vite.
- `api/**/*` no `tsconfig.json`.
- Remoção do script Umami com placeholders não configurados do `client/index.html`.

## Configuração no painel da Vercel

Framework Preset: Vite
Build Command: padrão (`pnpm run build`)
Output Directory: `dist/public`
Root Directory: `./`

## Teste depois do deploy

Abra:

`/api/health`

Deve retornar JSON semelhante a:

`{"ok":true,"service":"lexus-eletricos-api"}`

Depois, no DevTools > Network, a chamada `/api/trpc/auth.me` não deve mais retornar 404.

## Importante sobre login

O código atual ainda usa um fluxo OAuth específico do template original e depende de variáveis como:

- `VITE_OAUTH_PORTAL_URL`
- `VITE_APP_ID`
- `OAUTH_SERVER_URL`
- `JWT_SECRET`
- `DATABASE_URL`

Sem essas variáveis/serviços, o endpoint `auth.me` pode funcionar e retornar usuário nulo, mas o botão de login não completará a autenticação. Se a intenção for usar login próprio/Supabase ou checkout sem conta, essa parte precisa ser migrada separadamente.
