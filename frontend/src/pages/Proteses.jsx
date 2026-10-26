import { useEffect, useMemo, useState } from 'react';
import { api, apiError, uploadsUrl, authUrl } from '../api.js';
import { toast } from '../components/ui.jsx';

const TIPOS = ['Site institucional', 'Landing page', 'Loja virtual', 'Sistema web', 'Aplicativo', 'Automação / integração', 'Manutenção'];
const STATUS = ['Briefing', 'Planejamento', 'Desenvolvimento', 'Revisão', 'Concluído', 'Pausado'];
const STATUS_LEGADO = { 'orçado': 'Briefing', aprovado: 'Planejamento', moldagem: 'Desenvolvimento', laboratório: 'Desenvolvimento', prova: 'Revisão', pronta: 'Revisão', entregue: 'Concluído', ajuste: 'Revisão' };
const ETAPAS_ARQUIVO = ['Referências', 'Layout', 'Desenvolvimento', 'Revisão', 'Entrega'];
const ETAPAS_TAREFA = ['Briefing', 'Design', 'Desenvolvimento', 'Conteúdo', 'Testes', 'Publicação'];
const novoForm = { pacienteId: '', tipo: 'Site institucional', titulo: '', status: 'Briefing', valor: '', previsao: '', prioridade: 'Normal', escopo: '' };
const etapaAtual = (status) => STATUS_LEGADO[status] || STATUS.find((s) => s.toLowerCase() === String(status).toLowerCase()) || 'Briefing';
const moeda = (valor) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(valor || 0));
const dataPt = (valor) => {
  if (!valor) return 'Sem prazo';
  const d = /^\d{4}-\d{2}-\d{2}$/.test(valor) ? new Date(`${valor}T12:00:00`) : new Date(valor);
  return Number.isNaN(d.getTime()) ? valor : d.toLocaleDateString('pt-BR');
};
const draftDo = (p) => ({
  titulo: p.titulo || '', escopo: p.escopo || '', prioridade: p.prioridade || 'Normal',
  previsao: /^\d{4}-\d{2}-\d{2}$/.test(p.previsao || '') ? p.previsao : p.dataEntrega || '',
  responsavel: p.responsavel || '', siteUrl: p.siteUrl || '', repoUrl: p.repoUrl || ''
});

export default function Proteses() {
  const [lista, setLista] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [modo, setModo] = useState('kanban');
  const [form, setForm] = useState(novoForm);
  const [sel, setSel] = useState(null);
  const [draft, setDraft] = useState({});
  const [fotos, setFotos] = useState([]);
  const [etapa, setEtapa] = useState('Briefing');
  const [tarefa, setTarefa] = useState('');
  const [pagamento, setPagamento] = useState(false);
  const [valorPagamento, setValorPagamento] = useState('');
  const [formaPagamento, setFormaPagamento] = useState('pix');
  const [salvando, setSalvando] = useState(false);
  const [filtro, setFiltro] = useState('');

  const carregar = async () => {
    try {
      const [p, c] = await Promise.all([api.get('/api/proteses'), api.get('/api/pacientes')]);
      setLista(p.data);
      setClientes(c.data);
    } catch (e) { toast(apiError(e, 'Não foi possível carregar os projetos'), 'erro'); }
  };
  useEffect(() => { carregar(); }, []);
  useEffect(() => {
    if (!sel?.id) return;
    const atualizado = lista.find(p => p.id === sel.id);
    if (atualizado && atualizado !== sel) setSel(atualizado);
  }, [lista]);

  const abrir = async (p) => {
    setSel(p);
    setDraft(draftDo(p));
    setPagamento(false);
    try { const r = await api.get(`/api/proteses/${p.id}/fotos`); setFotos(r.data); }
    catch (e) { toast(apiError(e, 'Não foi possível carregar os arquivos'), 'erro'); }
  };

  const salvar = async (e) => {
    e.preventDefault();
    if (!form.pacienteId) return toast('Escolha um cliente para vincular o projeto', 'erro');
    setSalvando(true);
    try {
      await api.post('/api/proteses', { ...form, titulo: form.titulo.trim() || form.tipo, valor: Number(form.valor || 0), dataEntrega: form.previsao || '' });
      setForm(novoForm);
      await carregar();
      toast('Projeto criado ✓');
    } catch (err) { toast(apiError(err, 'Não foi possível criar o projeto'), 'erro'); }
    finally { setSalvando(false); }
  };

  const atualizarProjeto = async (patch, message = 'Projeto atualizado ✓') => {
    if (!sel) return;
    try {
      await api.put(`/api/proteses/${sel.id}`, patch);
      await carregar();
      if (message) toast(message);
    } catch (err) { toast(apiError(err, 'Não foi possível atualizar o projeto'), 'erro'); }
  };

  const salvarDetalhes = async (e) => {
    e.preventDefault();
    await atualizarProjeto({ ...draft, titulo: draft.titulo.trim() || sel.tipo, previsao: draft.previsao || '', dataEntrega: draft.previsao || '' });
  };

  const adicionarTarefa = async (e) => {
    e.preventDefault();
    const titulo = tarefa.trim();
    if (!titulo || !sel) return;
    const tarefas = [...(sel.tarefas || []), { id: `${Date.now()}`, titulo, concluida: false }];
    await atualizarProjeto({ tarefas }, null);
    setTarefa('');
  };

  const concluirTarefa = async (item) => {
    const tarefas = (sel.tarefas || []).map(t => t.id === item.id ? { ...t, concluida: !t.concluida } : t);
    await atualizarProjeto({ tarefas }, null);
  };

  const removerTarefa = async (item) => {
    const tarefas = (sel.tarefas || []).filter(t => t.id !== item.id);
    await atualizarProjeto({ tarefas }, null);
  };

  const uploadArquivo = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !sel) return;
    const fd = new FormData();
    fd.append('foto', file);
    fd.append('etapa', etapa);
    try {
      await api.post(`/api/proteses/${sel.id}/fotos`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      const r = await api.get(`/api/proteses/${sel.id}/fotos`);
      setFotos(r.data);
      toast('Arquivo anexado ✓');
    } catch (err) { toast(apiError(err, 'Não foi possível anexar o arquivo'), 'erro'); }
  };

  const excluirArquivo = async (id) => {
    if (!window.confirm('Remover este arquivo do projeto?')) return;
    try { await api.delete(`/api/fotos/${id}`); setFotos(await api.get(`/api/proteses/${sel.id}/fotos`).then(r => r.data)); }
    catch (e) { toast(apiError(e, 'Não foi possível remover o arquivo'), 'erro'); }
  };

  const registrarPagamento = async (e) => {
    e.preventDefault();
    const valor = Number(valorPagamento);
    if (!sel || !Number.isFinite(valor) || valor <= 0 || valor > Number(sel.saldo || 0)) return toast('Informe um valor maior que zero e até o saldo em aberto', 'erro');
    const cliente = sel.paciente?.empresa || sel.paciente?.nome || 'cliente';
    try {
      await api.post('/api/financeiro', { descricao: `Pagamento ${sel.titulo || sel.tipo} — ${cliente}`, valor, proteseId: sel.id, tipo: 'parcela', forma: formaPagamento, status: 'pago' });
      setPagamento(false);
      setValorPagamento('');
      await carregar();
      toast('Pagamento registrado ✓');
    } catch (err) { toast(apiError(err, 'Não foi possível registrar o pagamento'), 'erro'); }
  };

  const enviarProposta = async () => {
    try {
      const r = await api.post(`/api/proteses/${sel.id}/enviar-orcamento`);
      toast(r.data.enviado ? 'Proposta enviada pelo WhatsApp ✓' : 'WhatsApp indisponível; proposta ficou registrada como pendente.', r.data.enviado ? 'ok' : 'erro');
    } catch (e) { toast(apiError(e, 'Não foi possível enviar a proposta'), 'erro'); }
  };

  const excluirProjeto = async (p) => {
    if (!window.confirm(`Excluir o projeto “${p.titulo || p.tipo}”?`)) return;
    try { await api.delete(`/api/proteses/${p.id}`); if (sel?.id === p.id) setSel(null); await carregar(); toast('Projeto excluído'); }
    catch (e) { toast(apiError(e, 'Apenas administradores podem excluir projetos'), 'erro'); }
  };

  const filtrada = useMemo(() => lista.filter(p => {
    const text = `${p.titulo || ''} ${p.tipo || ''} ${p.paciente?.nome || ''} ${p.paciente?.empresa || ''}`.toLowerCase();
    return !filtro || text.includes(filtro.toLowerCase());
  }), [lista, filtro]);

  const tarefas = sel?.tarefas || [];
  const feitas = tarefas.filter(t => t.concluida).length;

  return (
    <div>
      <div className="page-head">
        <div><h2>Projetos</h2><p>Gerencie briefing, execução, entregas, arquivos e pagamentos</p></div>
        <div className="spacer" />
        <div className="toolbar"><input placeholder="🔍 Buscar projeto ou cliente..." value={filtro} onChange={e => setFiltro(e.target.value)} /></div>
        <button className={`btn btn-sm ${modo === 'kanban' ? 'btn-primary' : ''}`} onClick={() => setModo('kanban')}>Quadro</button>
        <button className={`btn btn-sm ${modo === 'lista' ? 'btn-primary' : ''}`} onClick={() => setModo('lista')}>Lista</button>
      </div>

      <div className="card project-create-card" style={{ marginBottom: 14 }}>
        <div className="page-head"><div><strong>Novo projeto</strong><p className="small muted">Defina o serviço, escopo, prazo e investimento inicial</p></div></div>
        {clientes.length === 0 && <p className="small">Cadastre um cliente antes de criar o primeiro projeto.</p>}
        <form onSubmit={salvar} className="form-card project-form">
          <select value={form.pacienteId} onChange={e => setForm({ ...form, pacienteId: e.target.value })} required>
            <option value="">Selecionar cliente *</option>
            {clientes.map(p => <option key={p.id} value={p.id}>{p.empresa ? `${p.empresa} — ${p.nome}` : p.nome}</option>)}
          </select>
          <select value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })}>{TIPOS.map(t => <option key={t}>{t}</option>)}</select>
          <input placeholder="Nome do projeto (ex.: Site da Padaria Central)" value={form.titulo} onChange={e => setForm({ ...form, titulo: e.target.value })} />
          <input aria-label="Investimento do projeto" placeholder="Investimento (R$)" type="number" min="0" step="0.01" value={form.valor} onChange={e => setForm({ ...form, valor: e.target.value })} />
          <label className="field-label">Prazo de entrega<input aria-label="Prazo de entrega" type="date" value={form.previsao} onChange={e => setForm({ ...form, previsao: e.target.value })} /></label>
          <select aria-label="Prioridade" value={form.prioridade} onChange={e => setForm({ ...form, prioridade: e.target.value })}><option>Normal</option><option>Alta</option><option>Urgente</option></select>
          <textarea className="project-scope" placeholder="Escopo: o que será criado, páginas, integrações, entregáveis e observações do briefing..." value={form.escopo} onChange={e => setForm({ ...form, escopo: e.target.value })} rows={3} />
          <div className="form-actions"><button className="btn btn-primary" type="submit" disabled={salvando || clientes.length === 0}>{salvando ? 'Criando...' : '+ Criar projeto'}</button></div>
        </form>
      </div>

      <div className={`project-layout ${sel ? 'with-selection' : ''}`}>
        <div>
          {modo === 'kanban' ? (
            <div className="kanban">
              {STATUS.map(s => {
                const itens = filtrada.filter(p => etapaAtual(p.status) === s);
                return <div key={s} className="kanban-col">
                  <h4>{s} <span className="pill">{itens.length}</span></h4>
                  {itens.map(p => (
                    <div key={p.id} className="kanban-card" role="button" tabIndex={0} onClick={() => abrir(p)} onKeyDown={e => e.key === 'Enter' && abrir(p)} style={{ cursor: 'pointer', border: sel?.id === p.id ? '2px solid #267461' : undefined }}>
                      <strong>{p.titulo || p.tipo}</strong>
                      <span className="small muted">{p.paciente?.empresa || p.paciente?.nome || 'Cliente'} • {p.tipo}</span>
                      <span className="small muted">{moeda(p.valor)} • prazo {dataPt(p.previsao || p.dataEntrega)}</span>
                      <select aria-label={`Etapa de ${p.titulo || p.tipo}`} value={etapaAtual(p.status)} onClick={e => e.stopPropagation()} onChange={e => atualizarProjetoCard(p, e.target.value)}>
                        {STATUS.map(o => <option key={o}>{o}</option>)}
                      </select>
                    </div>
                  ))}
                  {itens.length === 0 && <div className="kanban-empty">Nenhum projeto</div>}
                </div>;
              })}
            </div>
          ) : (
            <div className="card" style={{ padding: 0 }}>
              <div className="table-wrap" style={{ border: 0 }}>
                <table>
                  <thead><tr><th>Projeto</th><th>Cliente</th><th>Etapa</th><th>Prazo</th><th>Investimento</th><th>Ações</th></tr></thead>
                  <tbody>
                    {filtrada.map(p => (
                      <tr key={p.id} onClick={() => abrir(p)} style={{ cursor: 'pointer' }}>
                        <td><b>{p.titulo || p.tipo}</b><div className="small muted">{p.tipo}</div></td>
                        <td>{p.paciente?.empresa || p.paciente?.nome || '—'}</td>
                        <td><span className={`pill ${etapaAtual(p.status)}`}>{etapaAtual(p.status)}</span></td>
                        <td>{dataPt(p.previsao || p.dataEntrega)}</td>
                        <td className="small">{moeda(p.valor)}<div>Pago {moeda(p.totalPago)} · Saldo {moeda(p.saldo)}</div></td>
                        <td><button type="button" className="btn btn-sm" onClick={e => { e.stopPropagation(); excluirProjeto(p); }}>Excluir</button></td>
                      </tr>
                    ))}
                    {filtrada.length === 0 && <tr><td colSpan={6} className="muted">{filtro ? 'Nenhum projeto encontrado.' : 'Seus projetos aparecerão aqui.'}</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {sel && (
          <aside className="card project-detail">
            <div className="page-head"><div><span className="section-kicker">DETALHES DO PROJETO</span><h2>{sel.titulo || sel.tipo}</h2><p>{sel.paciente?.empresa || sel.paciente?.nome} · {sel.tipo}</p></div><button type="button" className="btn btn-sm" aria-label="Fechar detalhes" onClick={() => setSel(null)}>✕</button></div>
            <div className="project-money"><div><span>Investimento</span><b>{moeda(sel.valor)}</b></div><div><span>Recebido</span><b>{moeda(sel.totalPago)}</b></div><div><span>Saldo</span><b>{moeda(sel.saldo)}</b></div></div>
            <div className="form-row project-actions">
              <button type="button" className="btn btn-sm btn-primary" onClick={() => { setPagamento(true); setValorPagamento(String(sel.saldo || '')); }}>+ Registrar pagamento</button>
              <a className="btn btn-sm" href={authUrl(`/api/proteses/${sel.id}/orcamento.pdf`)} target="_blank" rel="noreferrer">Proposta PDF</a>
              <button type="button" className="btn btn-sm" disabled={!sel.paciente?.telefone} onClick={enviarProposta}>Enviar no WhatsApp</button>
            </div>
            {pagamento && <form className="payment-form" onSubmit={registrarPagamento}>
              <strong>Novo pagamento</strong><span className="small muted">Saldo disponível: {moeda(sel.saldo)}</span>
              <input type="number" min="0.01" max={sel.saldo} step="0.01" value={valorPagamento} onChange={e => setValorPagamento(e.target.value)} placeholder="Valor recebido" required />
              <select value={formaPagamento} onChange={e => setFormaPagamento(e.target.value)}><option value="pix">Pix</option><option value="cartao">Cartão</option><option value="boleto">Boleto</option><option value="dinheiro">Dinheiro</option></select>
              <div className="form-row"><button type="submit" className="btn btn-sm btn-primary">Confirmar pagamento</button><button type="button" className="btn btn-sm" onClick={() => setPagamento(false)}>Cancelar</button></div>
            </form>}

            <hr />
            <form className="project-details-form" onSubmit={salvarDetalhes}>
              <strong>Escopo e entrega</strong>
              <input aria-label="Nome do projeto" value={draft.titulo || ''} onChange={e => setDraft({ ...draft, titulo: e.target.value })} placeholder="Nome do projeto" />
              <textarea aria-label="Escopo do projeto" value={draft.escopo || ''} onChange={e => setDraft({ ...draft, escopo: e.target.value })} placeholder="Escopo e entregáveis combinados" rows={4} />
              <div className="form-row">
                <label className="field-label">Prazo<input type="date" value={draft.previsao || ''} onChange={e => setDraft({ ...draft, previsao: e.target.value })} /></label>
                <label className="field-label">Prioridade<select value={draft.prioridade || 'Normal'} onChange={e => setDraft({ ...draft, prioridade: e.target.value })}><option>Normal</option><option>Alta</option><option>Urgente</option></select></label>
              </div>
              <input value={draft.responsavel || ''} onChange={e => setDraft({ ...draft, responsavel: e.target.value })} placeholder="Responsável da equipe" />
              <input type="url" value={draft.siteUrl || ''} onChange={e => setDraft({ ...draft, siteUrl: e.target.value })} placeholder="Link do site publicado (https://...)" />
              <input type="url" value={draft.repoUrl || ''} onChange={e => setDraft({ ...draft, repoUrl: e.target.value })} placeholder="Link do repositório (https://...)" />
              <button className="btn btn-primary btn-sm" type="submit">Salvar detalhes</button>
            </form>

            <section className="project-tasks">
              <div className="page-head"><div><strong>Checklist de entrega</strong><p className="small muted">{feitas}/{tarefas.length} tarefas concluídas</p></div></div>
              {tarefas.length > 0 && <div className="task-progress"><span style={{ width: `${(feitas / tarefas.length) * 100}%` }} /></div>}
              <div className="task-list">
                {tarefas.map(t => <div className="task-item" key={t.id}>
                  <label><input type="checkbox" checked={Boolean(t.concluida)} onChange={() => concluirTarefa(t)} /><span className={t.concluida ? 'task-done' : ''}>{t.titulo}</span></label>
                  <button type="button" aria-label={`Remover tarefa ${t.titulo}`} onClick={() => removerTarefa(t)}>×</button>
                </div>)}
                {tarefas.length === 0 && <p className="small muted">Adicione etapas de briefing, design, desenvolvimento e publicação.</p>}
              </div>
              <form className="task-add" onSubmit={adicionarTarefa}>
                <input list="tarefas-sugeridas" value={tarefa} onChange={e => setTarefa(e.target.value)} placeholder="Adicionar tarefa..." />
                <datalist id="tarefas-sugeridas">{ETAPAS_TAREFA.map(t => <option key={t} value={t} />)}</datalist>
                <button type="submit" className="btn btn-sm">Adicionar</button>
              </form>
            </section>

            <hr />
            <strong>Arquivos do projeto</strong>
            <div className="form-row" style={{ margin: '8px 0' }}>
              <select value={etapa} onChange={e => setEtapa(e.target.value)}>{ETAPAS_ARQUIVO.map(x => <option key={x}>{x}</option>)}</select>
              <label className="btn btn-sm">Anexar material<input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" hidden onChange={uploadArquivo} /></label>
            </div>
            <div className="gallery">
              {fotos.map(f => <div key={f.id} className="photo">
                {f.mimeType === 'application/pdf' ? <a className="pdf-attachment" href={uploadsUrl(f.url)} target="_blank" rel="noreferrer">Abrir PDF</a> : <img src={uploadsUrl(f.url)} alt={f.etapa} />}
                <span title={f.originalName || f.legenda}>{f.etapa}</span><button type="button" onClick={() => excluirArquivo(f.id)}>Remover</button>
              </div>)}
              {fotos.length === 0 && <p className="muted small">Nenhum arquivo anexado.</p>}
            </div>
            <button type="button" className="btn btn-sm project-delete" onClick={() => excluirProjeto(sel)}>Excluir projeto</button>
          </aside>
        )}
      </div>
    </div>
  );

  async function atualizarProjetoCard(p, status) {
    try { await api.put(`/api/proteses/${p.id}`, { status }); await carregar(); }
    catch (e) { toast(apiError(e, 'Não foi possível atualizar a etapa'), 'erro'); }
  }
}
