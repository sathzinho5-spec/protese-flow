# Auditoria e plano de funcionamento — PróteseFácil

Revisado em 2026-10-02. Este documento descreve o código atual e os itens que ainda precisam ser resolvidos antes de usar dados reais.

## Fluxos encontrados

### Atendimento WhatsApp

O webhook da Evolution registra o contato e a mensagem recebida. O bot tenta responder; quando a equipe envia uma resposta manual, o bot é pausado para aquela conversa. A tela de atendimento recebe atualizações por Socket.IO. Sem uma Evolution conectada, os envios ficam registrados como pendentes e não chegam ao paciente.

### Agenda

Agendamentos podem ter data legada em texto ou data e hora ISO. O lembrete automático depende da integração WhatsApp e de configurar `enviarLembrete` no agendamento.

### Próteses

O fluxo configurado é `orçado → aprovado → moldagem → prova → laboratório → pronta → entregue`, com etapa de ajuste disponível. Ao marcar como entregue, são criados lembretes de acompanhamento para 7, 30, 180 e 365 dias.

### Financeiro

Os lançamentos podem ser associados a uma prótese; o painel calcula pago e saldo. Há PDF de orçamento e recibo. O estado pago depende de atualizar corretamente o lançamento.

### Acesso e dados

As senhas são armazenadas com hash e o painel usa tokens JWT. O primeiro usuário é o administrador inicial; o cadastro de pessoas para a equipe deve ser feito por um administrador. Cada clínica precisa configurar banco, chave JWT e credenciais próprias.

## Correções verificadas nesta revisão

- A interface React/Vite compila para produção.
- Em celular, ao abrir uma conversa, a lista dá lugar ao chat e há um botão de retorno.
- Animações leves respeitam a preferência do dispositivo por movimento reduzido.
- A textura do chat não depende mais de imagem hospedada em terceiro.
- Criar equipe exige sessão de administrador depois do primeiro cadastro. Consulta e edição da equipe também são exclusivas de administradores.
- A chave privada do banco foi removida do blueprint de hospedagem e substituída por uma variável a ser cadastrada no ambiente.
- Em produção, a API recusa inicialização sem `JWT_SECRET` forte (mínimo de 32 caracteres).
- Docker e backend usam a mesma variável de chave da Evolution.
- README e exemplo de ambiente descrevem inicialização e configuração sem credenciais reais.

## Pendências antes de atender pacientes

1. **Revogar e substituir as credenciais que já foram versionadas.** Chaves Supabase apareceram em `backend/render.yaml` e `backend/src/db-rest.js`; as cópias atuais foram removidas e substituídas por variáveis de ambiente. Elas continuam no histórico Git. Revogue-as no Supabase e crie novas antes de conectar o banco; a limpeza do histórico remoto exige reescrita da branch e deve ser coordenada com quem mais usa o repositório.
2. Configurar armazenamento durável de fotos e banco com backup. O disco local do serviço web pode ser efêmero e não deve ser tratado como backup.
3. Configurar domínio público da Evolution, webhook, chave própria e `FRONTEND_URL` / `VITE_API_URL` de produção.
4. Validar fluxos de recebimento, envio, lembretes, PDF e permissões no ambiente de implantação com contas de teste antes de cadastrar dados reais.
5. Fazer revisão de privacidade e retenção de dados com a clínica; fotos e observações podem conter informações de saúde.

## Limitações técnicas que permanecem

- A interface atualizada não substitui a validação operacional da integração WhatsApp: essa depende de credenciais e serviços externos.
- Não foi feita migração para API oficial do WhatsApp.
- O projeto ainda não tem cobertura automatizada abrangente de rotas e jornadas; a compilação da interface, por si só, não valida os fluxos de negócio.
- Antes de aumentar o volume ou operar várias instâncias, revisar paginação, persistência, backups e os limites do banco escolhido.
