# Lexus Elétricos — operação e segurança

## Arquitetura

A aplicação usa React + Vite + Tailwind no frontend, Express + tRPC no backend e Drizzle sobre PostgreSQL, compatível com Supabase. O catálogo do produto fica centralizado em `shared/catalog.ts`; o navegador mantém apenas o carrinho local para experiência de compra, enquanto o backend recalcula produto, variante, quantidade e preço antes de criar um pedido.

As tabelas `orders` e `order_items` estão definidas no schema PostgreSQL em `drizzle/schema.ts`, com migração inicial gerada em `drizzle-pg/0000_public_cable.sql`. A aplicação dessa migração depende da `DATABASE_URL` real do Supabase cadastrada no painel. O identificador de idempotência impede que o mesmo pedido autenticado seja criado duas vezes. Pedidos são criados inicialmente como `pending`.

## Settings → Secrets / Environment Variables

Configure os valores fora do código-fonte:

| Variável | Uso | Exposição |
| --- | --- | --- |
| `SUPABASE_URL` | URL do projeto Supabase | backend בלבד até a integração ser ativada |
| `SUPABASE_PUBLISHABLE_KEY` | chave pública do Supabase | pode ser usada no frontend somente quando a integração oficial estiver configurada |
| `SUPABASE_SECRET_KEY` | operações administrativas do Supabase | somente backend |
| `PANTERAPAY_SECRET_KEY` | credencial secreta de produção PantePay | somente backend |

O projeto atual também usa as variáveis nativas do template para autenticação Manus e banco (`DATABASE_URL`, `JWT_SECRET`, `OAUTH_SERVER_URL`, entre outras). Não substitua essas variáveis por valores versionados. As quatro variáveis acima devem ser criadas diretamente no painel de Secrets; nenhum valor real foi incluído no código-fonte. Nunca copie uma chave `sk_live_...` para o repositório, frontend, HTML, bundle, URL, localStorage, cookies acessíveis por JavaScript, logs ou mensagens de erro.

## Autenticação

O scaffold fornece autenticação Manus OAuth server-side, com sessão em cookie HttpOnly e procedimentos protegidos por `protectedProcedure`. A página `/conta` exige autenticação e o checkout exige sessão para validar o pedido.

A migração para Supabase Auth ainda depende das credenciais e da decisão de substituir ou coexistir com o OAuth nativo do ambiente. Não foram inventados Client IDs, Client Secrets, Team IDs, Service IDs ou chaves externas.

### Supabase Auth pendente de configuração externa

Quando o Supabase for habilitado, configure no painel:

1. Email/password, confirmação de e-mail e recuperação de senha.
2. Google e Apple como provedores OAuth.
3. Redirect URL: `https://rfbnsagqhbnkmvzcqxvs.supabase.co/auth/v1/callback`.
4. URLs adicionais do ambiente de preview e produção, conforme os domínios reais.
5. Tabelas privadas com RLS e políticas que comparem o proprietário ao usuário autenticado. Senhas não devem ser armazenadas em `profiles`.

Não foi possível verificar essas configurações neste ambiente porque não foram fornecidas credenciais/configuração do projeto Supabase.

## PantePay

A tela e o contrato de pedidos estão preparados para a integração, mas o pagamento real não foi ativado. A documentação oficial da PantePay, endpoint, formato do payload, autenticação, mecanismo de assinatura de webhook e URL de callback não foram fornecidos. Portanto, nenhum endpoint ou mecanismo de assinatura foi inventado.

Antes de produção, configure `PANTERAPAY_SECRET_KEY` em **Settings → Secrets / Environment Variables** e confirme na documentação da PantePay:

- endpoint oficial por ambiente sandbox/produção;
- criação de pagamento e campos obrigatórios;
- idempotência exigida pelo provedor;
- webhook oficial e forma de validação de autenticidade;
- eventos de pagamento aprovado, recusado e estornado;
- timeout, retry e política de replay.

Até essa configuração, pedidos permanecem `pending` e não são apresentados como pagos. O frontend nunca envia preço confiável: o servidor usa o catálogo de `shared/catalog.ts`.

## Meta Pixel

O Meta Pixel `1724233682208521` está no `<head>` de `client/index.html`, com o snippet fornecido. O `PageView` é disparado somente no carregamento inicial do documento; não foram adicionados eventos de compra fictícios. Não há inicialização em componentes React, evitando duplicação por hidratação ou navegação interna.

## Funcionalidades entregues

- Página de produto INOW 1000W com as três imagens fornecidas, sem filtros ou substituições.
- Seleção real de Preto/Caramelo, galeria, thumbnails, zoom e troca com estado controlado.
- Carrinho persistido no navegador, com alteração de quantidade, remoção e subtotal.
- Checkout com validação de sessão, idempotência e recálculo server-side.
- Página de conta protegida pelo fluxo OAuth existente.
- Layout mobile-first, foco visível, labels/aria, reduced motion e SEO básico com Open Graph e JSON-LD.

## Auditoria e limitações

Foram revisados os pontos implementados no código: preço enviado pelo cliente não é confiado; quantidade e variantes são limitadas por schema; o procedimento de pedido é protegido; a idempotência é persistida; nenhum segredo é referenciado em componentes client-side; as imagens são URLs fornecidas pelo proprietário; o status inicial é `pending`.

Não foi possível verificar neste ambiente: configuração real do Supabase/RLS, credenciais e endpoints PantePay, assinatura de webhooks PantePay, fluxos externos Google/Apple, execução de pagamento sandbox/produção e comportamento em dispositivos físicos. Também não foi afirmada segurança absoluta.
