# [Compras EMC] Sistema de Planejamento e Execução (2025-26)

Aplicação web completa para substituir as planilhas `[Compras EMC] PLANEJAMENTO (2025-26)` e `[Compras EMC] EXECUÇÃO (2025-26)`, mantendo todas as abas, cálculos automáticos, envio de e-mails agendados e sincronização com o Google Agenda.

## Estrutura do Projeto

- `src/`: Interface Web (React + Vite + Tailwind CSS) para hospedagem gratuita no **GitHub Pages**.
  - **Planejamento (5 Etapas):** Abas padronizadas de Etapa 1 a Etapa 5 (com todas as 18 colunas), importação/exportação CSV e aba **Cronograma Anual & Agenda**.
  - **Execução & Saldos:** Abas **Saldo Anual**, **Execução** (abate automático de saldo por pedido/empenho) e **Atas Vigentes**.
  - **Equipe, Grupos & E-mails:** Gestão de destinatários, grupos SIASG por etapa e disparos manuais/testes.
- `supabase/`:
  - `schema.sql`: Tabelas, gatilhos automáticos de saldo, view de Atas Vigentes e políticas de segurança (RLS).
  - `seed.sql`: Carga inicial com a Equipe, Cronograma Anual e Grupos das 5 etapas.
- `scripts/automations.mjs` & `.github/workflows/automacoes.yml`:
  - Substitui os gatilhos do Google Apps Script rodando gratuitamente via **GitHub Actions** (diariamente às 07h e 08h BRT, e todo dia 1º de cada mês).

---

## Como fazer o Push para o GitHub e Colocar no Ar

### 1. Subir este código para o GitHub
Abra o terminal dentro desta pasta (`compras-emc-ufsc`) e execute:

```bash
git init
git add .
git commit -m "Versão inicial - Sistema Compras EMC"
git branch -M main
git remote add origin https://github.com/SEU-USUARIO/compras-emc-ufsc.git
git push -u origin main
```

### 2. Configurar o Banco de Dados (Supabase - Gratuito)
1. Acesse [supabase.com](https://supabase.com) e crie um novo projeto.
2. Abra o **SQL Editor**, cole e execute o arquivo `supabase/schema.sql`.
3. Em seguida, execute o arquivo `supabase/seed.sql` para carregar a Equipe, o Cronograma Anual e os Grupos.
4. Em **Authentication > URL Configuration**, adicione a URL do seu GitHub Pages:
   `https://SEU-USUARIO.github.io/compras-emc-ufsc/`

### 3. Configurar Secrets no GitHub
No seu repositório no GitHub, vá em **Settings > Secrets and variables > Actions** e cadastre:

| Secret | Descrição |
| :--- | :--- |
| `VITE_SUPABASE_URL` | URL do projeto Supabase (ex: `https://xyz.supabase.co`) |
| `VITE_SUPABASE_ANON_KEY` | Chave `anon` pública do Supabase |
| `SUPABASE_URL` | Mesma URL do projeto Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Chave `service_role` do Supabase (usada pelo robô de e-mail) |
| `SMTP_HOST` | `smtp.gmail.com` |
| `SMTP_PORT` | `465` |
| `SMTP_USER` | E-mail remetente (ex: `teo.balconi@polo.ufsc.br`) |
| `SMTP_PASS` | Senha de App de 16 dígitos gerada na Conta Google |
| `GOOGLE_CALENDAR_ID` | `c_473bfaf8f332eb7ed994b00f8401a9719a50ae0817c307e64359e41b5779058d@group.calendar.google.com` |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | JSON completo da Service Account do Google Cloud (com permissão na agenda) |
| `VITE_GITHUB_DISPATCH_TOKEN` | *(Opcional)* Token PAT com permissão `Actions: Read and write` para botões manuais na tela |

### 4. Ativar o GitHub Pages
1. No GitHub, vá em **Settings > Pages**.
2. Em **Build and deployment > Source**, selecione **GitHub Actions**.
3. O workflow `.github/workflows/deploy.yml` publicará o site automaticamente.

### 5. Importar Dados Existentes das Planilhas
No Google Sheets, abra cada aba (`planejamento (etapa 1)` a `5` e `Saldo Anual`), clique em **Arquivo > Fazer download > Valores separados por vírgula (.csv)** e use o botão **Importar CSV** diretamente na tela correspondente do sistema.
