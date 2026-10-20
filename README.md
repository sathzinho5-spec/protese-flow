# Seth Digital

Painel interno para uma empresa que cria sites, sistemas e automações para negócios. O sistema reúne clientes, projetos, prazos, propostas, financeiro, conversas de WhatsApp e acompanhamento de entregas.

## Recursos

- Acesso por conta e permissões da equipe; o primeiro cadastro cria o administrador inicial.
- Cadastro de clientes, contatos, empresas e histórico de conversas.
- Projetos em quadro por etapa, com anexos, escopo, valor e previsão.
- Agenda, tarefas, lembretes e acompanhamento pós-entrega.
- Caixa de entrada para WhatsApp, com opção de assumir conversas do agente.
- Propostas e recibos em PDF, lançamentos financeiros e relatórios.
- Integração opcional com Evolution API e agentes de IA configuráveis.

Sem credenciais da Evolution, o sistema pode ser explorado localmente; as mensagens ficam registradas, mas não são entregues pelo WhatsApp.

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

No Windows, execute `iniciar-local.ps1` na pasta do projeto. O script prepara o ambiente local e inicia a API e o painel. O primeiro uso da Evolution exige conectar a instância e ler o QR Code do WhatsApp.

O painel publicado em <https://protese-flow.vercel.app> pode ser usado no mesmo computador quando a API local estiver iniciada e configurada. O endereço usa o nome antigo do projeto; a identidade exibida no sistema é Seth Digital. O navegador em outro computador ou celular não consegue acessar o `localhost` do seu computador. Para acesso externo, hospede a API ou configure um túnel HTTPS seguro.

Na tela WhatsApp, use **Buscar QR Code**, escaneie com o WhatsApp e clique em **Configurar webhook** para registrar o recebimento de mensagens no backend. O QR aparece como imagem quando a Evolution retorna o campo base64.

Essa configuração local não tem custo de hospedagem, mas depende de o computador, Docker e internet permanecerem ligados. Para dados comerciais reais, configure credenciais fortes, backups e armazenamento persistente. Não publique a porta da Evolution diretamente na internet.

## Publicação

- Frontend: o diretório `frontend` está configurado para Vercel; defina `VITE_API_URL` com a URL pública da API.
- Backend e Evolution API: `render.yaml` descreve os serviços e discos persistentes no Render. Ao criar o Blueprint, configure `SUPABASE_URL`, uma nova `SUPABASE_SERVICE_KEY` e `FRONTEND_URL`. A chave de serviço deve ficar apenas no backend.
- A chave da Evolution e o JWT devem ser configurados como variáveis de ambiente; não use valores de produção no repositório.
- No Vercel, importe o repositório com Root Directory `frontend`. Depois de obter a URL pública do backend, configure `VITE_API_URL` e publique novamente.
- Serviços pagos e discos persistentes podem gerar cobrança; confira os preços atuais antes de provisionar.

## Estrutura

- `frontend/src/pages`: telas do painel.
- `frontend/src/styles.css`: estilos e adaptação para celular.
- `backend/src/routes`: endpoints da aplicação.
- `backend/src/services`: automações, WhatsApp, agentes, PDFs e lembretes.
- `supabase/schema.sql`: esquema do banco remoto.
- `PLANO_DE_FUNCIONAMENTO.md`: fluxos, verificações e pendências técnicas.

Alguns nomes de rotas e tabelas ainda são legados por compatibilidade com dados existentes; os nomes exibidos na interface e a configuração do agente são voltados à Seth Digital.
