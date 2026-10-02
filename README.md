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

No Windows, execute `iniciar-local.ps1` na pasta do projeto. O script cria `backend/.env` a partir do exemplo, instala dependencias se necessario, reutiliza uma Evolution ja acessivel em `localhost:8080` (ou sobe a copia deste projeto caso nao haja nenhuma), inicia a API local e abre o painel publicado no Vercel. Se pedir, informe a chave da Evolution na entrada oculta; ela fica somente em `backend/.env`. O primeiro uso ainda exige conectar a instancia e ler o QR Code do WhatsApp.

O painel publicado em <https://protese-flow.vercel.app> pode ser usado sem custo no mesmo computador quando a API local estiver iniciada. O iniciador abre a interface publicada e conecta o navegador ao backend em `localhost:3001`; em outro computador ou celular, `localhost` aponta para o proprio aparelho e a API nao estara acessivel. Para acessar de fora da maquina sera preciso configurar um tunel HTTPS ou hospedar a API.

Na tela WhatsApp, use **Buscar QR Code** para uma instancia que ja existe, escaneie no WhatsApp e clique em **Configurar webhook** para registrar o recebimento de mensagens no backend local. O QR aparece como imagem quando a Evolution retorna o campo base64.

Esta opcao nao tem custo de hospedagem, mas depende do computador, Docker e internet permanecerem ligados. O sistema local e apropriado para desenvolvimento e demonstracao; antes de usar com dados reais de pacientes, configure credenciais fortes, backup e armazenamento persistente. O webhook local da Evolution ja aponta para o backend no computador e nao exige URL publica. Para abrir o painel em outros aparelhos pela internet ou receber webhooks de servicos externos, sera necessario configurar uma URL HTTPS segura; nao publique a porta da Evolution diretamente na internet.

Para testar a integração com WhatsApp, configure a mesma `EVOLUTION_API_KEY` no backend e no Docker Compose, inicie o serviço com `docker compose up -d`, crie a instância e leia o QR Code na tela WhatsApp. Configure o webhook da Evolution para `/webhook/evolution` e habilite `messages.upsert`.

## Publicação

- Frontend: o diretório `frontend` tem configuração para Vercel; defina `VITE_API_URL` com a URL pública da API.
- Backend e Evolution API: o blueprint `render.yaml` cria a API Node, a Evolution privada na mesma rede e discos persistentes para as sessões e fotos. Ao criar o Blueprint no Render, preencha `SUPABASE_URL`, uma nova `SUPABASE_SERVICE_KEY` e a URL de produção do frontend em `FRONTEND_URL`. A chave de serviço deve ter acesso restrito e nunca pode ser usada no frontend.
- A chave de acesso da Evolution e o JWT são gerados pelo Render e ligados entre os serviços. A API usa o hostname privado da Evolution; o webhook aponta para a API pública.
- Frontend: importe o repositório no Vercel com Root Directory `frontend`. Após o Render informar a URL do backend, adicione `VITE_API_URL` com essa URL nas variáveis do projeto Vercel e publique novamente.
- Os serviços Render configurados como `starter` e os discos persistentes têm cobrança. Confira o preço atual antes de criar o Blueprint.

Antes de cadastrar pacientes reais, confirme o armazenamento persistente de fotos, backups do banco e credenciais de produção. Não use dados reais de pacientes em uma instalação de demonstração.

## Estrutura

- `frontend/src/pages`: telas do painel.
- `frontend/src/styles.css`: estilos e adaptação para celular.
- `backend/src/routes`: endpoints por domínio.
- `backend/src/services`: automações, WhatsApp, PDFs e lembretes.
- `supabase/schema.sql`: esquema do banco remoto.
- `PLANO_DE_FUNCIONAMENTO.md`: fluxos e pendências conhecidas.
