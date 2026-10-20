# Funcionamento e pendências — Seth Digital

Revisado em 2026-10-20. O sistema organiza o atendimento e a operação de uma empresa que desenvolve sites, sistemas e automações para negócios.

## Fluxos

### Atendimento e WhatsApp

O webhook da Evolution registra o contato e a mensagem recebida. O agente pode responder conforme a configuração da empresa; quando a equipe envia uma resposta manual, a automação é pausada para aquela conversa. A tela de atendimento recebe atualizações em tempo real. Sem Evolution conectada, os envios ficam registrados como pendentes e não chegam ao WhatsApp.

### Clientes e projetos

Os contatos ficam associados a clientes e empresas. Os projetos passam por briefing, planejamento, desenvolvimento, revisão e conclusão, com possibilidade de pausa, anexos, escopo, valor e previsão. O banco mantém identificadores antigos para preservar os dados já cadastrados.

### Agenda e acompanhamento

Compromissos podem ter data legada em texto ou data e hora ISO. Lembretes dependem da integração WhatsApp e da opção de envio habilitada no registro. Projetos concluídos podem gerar acompanhamentos pós-entrega.

### Financeiro

Lançamentos podem ser associados a clientes e projetos. O painel calcula valores recebidos e pendentes; propostas e recibos podem ser gerados em PDF. O saldo depende de manter os lançamentos atualizados.

### Acesso e dados

As senhas são armazenadas com hash e o painel usa tokens JWT. O primeiro usuário é o administrador inicial; a criação e gestão da equipe ficam restritas a administradores.

## Verificações realizadas

- A interface React/Vite compila para produção.
- Em celular, a lista de conversas dá lugar ao chat e há um botão de retorno.
- Animações leves respeitam a preferência do dispositivo por movimento reduzido.
- A textura do chat não depende de imagem hospedada em terceiro.
- A gestão de equipe exige sessão de administrador.
- A chave privada do banco fica em variável de ambiente, fora do frontend.
- Em produção, a API exige `JWT_SECRET` forte.
- Docker e backend usam a mesma variável de chave da Evolution.
- O agente foi direcionado para a Seth Digital: não deve inventar preços, prazos ou status e deve pedir escopo antes de falar de valores.

## Antes de operar com dados reais

1. Revogue e substitua credenciais que tenham sido publicadas anteriormente no histórico Git; removê-las do código atual não invalida as cópias já expostas.
2. Configure armazenamento durável para arquivos e banco, além de backups testados.
3. Configure URL pública HTTPS, webhook, chave própria da Evolution e `FRONTEND_URL` / `VITE_API_URL` no ambiente de produção.
4. Valide recebimento e envio de WhatsApp, lembretes, PDFs, permissões e recuperação de senha no ambiente implantado.
5. Defina acesso e retenção para dados de clientes, conversas, propostas e arquivos.

## Limitações técnicas

- A compilação da interface e os testes automatizados não confirmam a conexão com serviços externos nem substituem a validação dos fluxos de produção.
- A integração usa Evolution API; o projeto não foi migrado para a API oficial do WhatsApp.
- Alguns endpoints e tabelas conservam nomes antigos para manter compatibilidade com registros existentes.
- Antes de aumentar o volume ou operar várias empresas, revisar isolamento de dados, paginação, persistência, backups e limites do banco.
