-- Schema Supabase (Postgres) — PróteseFácil
-- Rode no SQL Editor do Supabase (copie tudo e Run).
-- Sem RLS (backend usa service_role). Se ligar RLS, crie policies permissivas p/ service_role.

create table if not exists usuarios (
  id text primary key, createdat text, updatedat text, extras jsonb,
  nome text, email text unique, senhahash text, papel text, ativo boolean
);
create table if not exists pacientes (
  id text primary key, createdat text, updatedat text, extras jsonb,
  nome text, telefone text, nascimento text, observacoes text, origem text
);
create table if not exists proteses (
  id text primary key, createdat text, updatedat text, extras jsonb,
  pacienteid text, tipo text, status text, valor numeric, previsao text,
  garantiameses numeric, observacoes text
);
create table if not exists agendamentos (
  id text primary key, createdat text, updatedat text, extras jsonb,
  pacienteid text, pacientenome text, telefone text, data text, dataiso text,
  motivo text, dentista text, status text, origem text,
  lembreteenviado boolean, enviarlembrete boolean, motivocancel text
);
create table if not exists conversas (
  id text primary key, createdat text, updatedat text, extras jsonb,
  telefone text, ultimotexto text, naolidas numeric
);
create table if not exists mensagens (
  id text primary key, createdat text, updatedat text, extras jsonb,
  telefone text, direcao text, texto text, autor text, enviado boolean
);
create table if not exists botsessions (
  id text primary key, createdat text, updatedat text, extras jsonb,
  phone text, step text, data jsonb, botativo boolean
);
create table if not exists lancamentos (
  id text primary key, createdat text, updatedat text, extras jsonb,
  descricao text, valor numeric, proteseid text, pacienteid text,
  forma text, tipo text, status text, data text
);
create table if not exists fotos (
  id text primary key, createdat text, updatedat text, extras jsonb,
  proteseid text, url text, legenda text, etapa text, autor text
);
create table if not exists logs (
  id text primary key, createdat text, updatedat text, extras jsonb,
  autor text, papel text, acao text, entidade text, entidadeid text, detalhe text
);
create table if not exists followups (
  id text primary key, createdat text, updatedat text, extras jsonb,
  proteseid text, pacienteid text, telefone text, titulo text, mensagem text,
  previstoPara text, status text, dias numeric
);
-- Nota: o Postgres dobra identificadores p/ minúsculas; o driver mapeia
-- camelCase do app (pacienteId, dataISO, previstoPara...) ↔ colunas minúsculas.
create table if not exists agents (
  id text primary key, createdat text, updatedat text, extras jsonb,
  nome text, descricao text, prompt text, funcoes jsonb, gatilhos text,
  prioridade numeric, ativo boolean, modelo text
);
create table if not exists agent_runs (
  id text primary key, createdat text, updatedat text, extras jsonb,
  agentid text, agentnome text, telefone text, entrada text, intencao text,
  funcao text, via text, resposta text
);
create table if not exists agent_settings (
  id text primary key, createdat text, updatedat text, extras jsonb,
  provider text, model text, baseurl text, apikey text
);
create table if not exists providers (
  id text primary key, createdat text, updatedat text, extras jsonb,
  nome text, tipo text, baseurl text, model text, apikey text,
  ativo boolean, padrao boolean, ultimoteste text, ultimostatus text
);

create index if not exists idx_pacientes_tel on pacientes (telefone);
create index if not exists idx_conversas_tel on conversas (telefone);
create index if not exists idx_mensagens_tel on mensagens (telefone);
create index if not exists idx_mensagens_created on mensagens (createdat);
