# Compras EMC - Planejamento e Execução

Aplicação React/Vite para organizar as cinco etapas de planejamento de compras, acompanhar saldos e pedidos, administrar a equipe e enviar avisos por e-mail. Os dados ficam no Supabase; o site e as automações são publicados/executados pelo GitHub.

## O que está implementado

- Planejamento das etapas 1 a 5, com cadastro, edição, busca e importação/exportação CSV.
- Cronograma anual e integração opcional com Google Agenda.
- Saldo anual, atas vigentes e pedidos/empenhos com recálculo de saldo no banco.
- Acesso por link mágico de e-mail e autorização baseada na tabela `equipe`.
- E-mails automáticos por GitHub Actions.
- Acionamento manual seguro via Supabase Edge Function. O token do GitHub fica no Supabase e não é incluído no JavaScript público.

## Configuração inicial

### 1. Revise os destinatários antes de carregar os dados

Abra `supabase/seed.sql` e confirme/ajuste os e-mails da equipe e os dados de cronograma/grupos. As pessoas ativas em `equipe` podem acessar o sistema e também recebem os e-mails automáticos. Execute o seed somente uma vez no banco vazio.

### 2. Configure o banco e autenticação no Supabase

1. Crie um projeto no [Supabase](https://supabase.com).
2. No **SQL Editor**, execute `supabase/schema.sql` e depois `supabase/seed.sql`.
3. Em **Authentication > Providers**, habilite o provedor de e-mail.
4. Em **Authentication > URL Configuration**, configure:
   - Site URL: `https://teobalconi.github.io/compras-emc-ufsc/`
   - Redirect URLs: `https://teobalconi.github.io/compras-emc-ufsc/` e `http://localhost:5173/`

### 3. Cadastre os secrets do GitHub Actions

No repositório, abra **Settings > Secrets and variables > Actions > New repository secret** e cadastre:

| Secret | Valor/uso |
| --- | --- |
| `VITE_SUPABASE_URL` | URL do projeto Supabase |
| `VITE_SUPABASE_ANON_KEY` | Chave pública `anon`/publishable do Supabase |
| `SUPABASE_URL` | A mesma URL do projeto |
| `SUPABASE_SERVICE_ROLE_KEY` | Chave `service_role`; usada apenas pelo job de automações |
| `SMTP_HOST` | Host SMTP, por exemplo `smtp.gmail.com` |
| `SMTP_PORT` | Porta SMTP SSL, normalmente `465` |
| `SMTP_USER` | Endereço de e-mail remetente |
| `SMTP_PASS` | Senha de app do provedor de e-mail |

Para usar os comandos de Google Agenda, cadastre também:

| Secret | Valor/uso |
| --- | --- |
| `GOOGLE_CALENDAR_ID` | ID da agenda compartilhada |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | JSON da Service Account com acesso de edição à agenda |

Nunca use a chave `service_role`, a senha SMTP ou a chave privada Google como variável `VITE_*`: variáveis desse tipo são incorporadas ao site público.

### 4. Configure o acionamento manual protegido

O botão de automação chama uma Edge Function que verifica a sessão e a participação ativa na equipe antes de despachar um workflow. O token do GitHub precisa ficar como secret **do Supabase**, não no navegador.

1. Crie um Fine-grained Personal Access Token no GitHub para `teobalconi/compras-emc-ufsc`, com permissão **Actions: Read and write**.
2. Na raiz do projeto, crie localmente o arquivo `.env.functions` com:

   ```dotenv
   GITHUB_ACTIONS_TOKEN=cole_o_token_aqui
   GITHUB_REPOSITORY=teobalconi/compras-emc-ufsc
   ```

3. No terminal, execute:

   ```powershell
   npx.cmd supabase login
   npx.cmd supabase link --project-ref SEU_PROJECT_REF
   npx.cmd supabase secrets set --env-file .env.functions
   npx.cmd supabase functions deploy trigger-automation
   ```

   O `SEU_PROJECT_REF` aparece na URL do projeto ou em **Project Settings > General**.
4. Apague o arquivo `.env.functions` depois do envio. Ele está excluído pelo `.gitignore`; nunca o envie ao GitHub ou compartilhe.

### 5. Publique o site

1. No GitHub, abra **Settings > Pages** e selecione **GitHub Actions** como fonte de publicação.
2. Confirme que os secrets `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` estão cadastrados.
3. Faça commit e push do projeto para a branch `main`.
4. O workflow `Deploy GitHub Pages` compila e publica o site após o push. Consulte o resultado em **Actions**.

O endereço deste repositório é `https://teobalconi.github.io/compras-emc-ufsc/`.

### 6. Ative e teste os avisos

O workflow `Automações Compras EMC` executa alertas às 07h e 08h (horário de Brasília); no primeiro dia do mês, também envia os resumos mensais. O GitHub pode iniciar execuções agendadas com atraso.

Antes de depender dos avisos, confira os secrets de SMTP e execute um teste em **Equipe, Grupos & E-mails**. Os testes de e-mail são enviados somente ao primeiro membro ativo da equipe. Os comandos de agenda apagam/criam eventos; revise a agenda e as permissões da Service Account antes de usá-los.

### 7. Importe os dados das planilhas

Exporte cada aba do Google Sheets como CSV e importe pela aba correspondente no sistema. Confira as colunas e os valores após a importação, especialmente os saldos iniciais. Para saldos já consumidos antes do sistema, importe o saldo atual como `Qt. Def. Setor` ou registre os pedidos anteriores; o saldo é recalculado com base nessa quantidade e nos pedidos não cancelados registrados no sistema.

## Desenvolvimento local

1. Copie `.env.example` para `.env` e preencha `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.
2. Instale e execute:

   ```powershell
   npm.cmd ci
   npm.cmd run dev
   ```

3. Para validar a compilação:

   ```powershell
   npm.cmd run build
   ```
