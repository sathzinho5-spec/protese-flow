# PróteseFácil

Painel de atendimento e operação para clínicas odontológicas com foco em próteses. Reúne conversas de WhatsApp, pacientes, agenda, etapas das próteses, pagamentos, relatórios e acompanhamento pós-entrega.

## O que já está implementado

- Acesso por conta e permissões de equipe; o primeiro cadastro cria o administrador inicial.
- Cadastro e histórico de pacientes.
- Kanban de próteses, fotos de evolução, orçamento em PDF e pagamentos.
- Agenda com confirmação e lembretes.
- Caixa de entrada com conversas em tempo real e opção de assumir o atendimento do bot.
- Relatórios, auditoria e acompanhamentos pós-entrega.
- Integração opcional com Evolution API para WhatsApp.

Sem credenciais da Evolution, o sistema pode ser explorado localmente; mensagens ficam registradas, mas não são entregues pelo WhatsApp.

## Rodar localmente

Requer Node.js 22 ou superior para o banco SQLite nativo. O Docker é opcional e só é necessário para conectar uma instância local da Evolution API.

1. Copie `backend/.env.example` para `backend/.env` e ajuste os valores locais.
2. Instale e inicie a API:

   ```sh
   cd backend
   npm install
   npm run dev
   ```

3. Em outro terminal, instale e inicie o painel:

   ```sh
   cd frontend
   npm install
   npm run dev
   ```

4. Abra <http://localhost:5173> e crie o primeiro acesso de administrador.

Para testar a integração com WhatsApp, configure a mesma `EVOLUTION_API_KEY` no backend e no Docker Compose, inicie o serviço com `docker compose up -d`, crie a instância e leia o QR Code na tela WhatsApp. Configure o webhook da Evolution para `/webhook/evolution` e habilite `messages.upsert`.

## Publicação

- Frontend: o diretório `frontend` tem configuração para Vercel; defina `VITE_API_URL` com a URL pública da API.
- Backend: há um blueprint para Render em `backend/render.yaml`. Configure `JWT_SECRET` (mínimo de 32 caracteres), `SUPABASE_SERVICE_KEY`, `EVOLUTION_API_KEY`, `EVOLUTION_API_URL` e `FRONTEND_URL` no painel do serviço. As chaves secretas não devem ser colocadas no repositório.
- Configure a URL pública do Supabase em `SUPABASE_URL`. A credencial de serviço do Supabase deve ter acesso restrito e nunca ser usada no frontend.
- O envio real de WhatsApp precisa de uma Evolution API acessível publicamente pelo backend. `localhost` não serve como endereço da Evolution hospedada separadamente.

Antes de cadastrar pacientes reais, confirme o armazenamento persistente de fotos, backups do banco e credenciais de produção. Não use dados reais de pacientes em uma instalação de demonstração.

## Estrutura

- `frontend/src/pages`: telas do painel.
- `frontend/src/styles.css`: estilos e adaptação para celular.
- `backend/src/routes`: endpoints por domínio.
- `backend/src/services`: automações, WhatsApp, PDFs e lembretes.
- `supabase/schema.sql`: esquema do banco remoto.
- `PLANO_DE_FUNCIONAMENTO.md`: fluxos e pendências conhecidas.
