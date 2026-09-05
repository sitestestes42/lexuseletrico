# Variáveis de ambiente

Configure estas variáveis em **Settings → Secrets / Environment Variables** do projeto. Não edite arquivos `.env` no código-fonte e não faça commit de credenciais.

```text
SUPABASE_URL=
SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
PANTERAPAY_SECRET_KEY=
```

`SUPABASE_URL` e `SUPABASE_PUBLISHABLE_KEY` são dados de configuração pública apenas quando a integração oficial estiver habilitada. `SUPABASE_SECRET_KEY` e `PANTERAPAY_SECRET_KEY` são sempre privados e devem ser lidos exclusivamente no backend. Nenhuma dessas variáveis está necessária para visualizar a vitrine atual; o checkout real com PantePay e a migração completa para Supabase dependem da documentação e configuração externa correspondentes.
