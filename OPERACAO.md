# Operação — Lexus Elétricos V3

## Autenticação

O login antigo foi substituído por Supabase Auth. O navegador chama `/api/auth/login` ou `/api/auth/signup`; o backend conversa com o Supabase e grava `access_token` e `refresh_token` em cookies `HttpOnly`, `SameSite=Lax` e `Secure` em produção.

`auth.me` verifica a sessão Supabase e tenta sincronizar o usuário com a tabela `users`. Se o banco ainda não tiver sido migrado, o login continua funcionando, mas pedidos ficam bloqueados até a migração ser aplicada.

## Pedidos

O servidor recalcula o total a partir de `shared/catalog.ts`, valida variante/quantidade e usa `idempotencyKey` persistida para evitar pedido duplicado.

## PantePay

As variáveis continuam no backend, mas a chamada real da PantePay não foi inventada. Só conecte criação de pagamento/webhook depois de validar endpoint, payload, autenticação e assinatura na documentação oficial do provedor.
