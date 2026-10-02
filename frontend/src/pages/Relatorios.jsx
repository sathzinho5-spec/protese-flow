import { useEffect, useState } from 'react';
import { api } from '../api.js';

function Bar({ label, value, max, color }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div className="small" style={{ display: 'flex', justifyContent: 'space-between' }}><span>{label}</span><b>{value}</b></div>
      <div style={{ height: 8, background: '#f1f5f9', borderRadius: 6 }}>
        <div style={{ width: `${max ? Math.round((value / max) * 100) : 0}%`, height: '100%', background: color || '#0e7c61', borderRadius: 6 }} />
      </div>
    </div>
  );
}

export default function Relatorios() {
  const [r, setR] = useState(null);
  useEffect(() => { api.get('/api/relatorios').then(x => setR(x.data)); }, []);
  if (!r) return <p className="muted">Carregando...</p>;
  const maxStatus = Math.max(1, ...Object.values(r.porStatus));
  const maxForma = Math.max(1, ...Object.values(r.porForma));

  const csv = () => {
    const linhas = ['tipo,status,qtd', ...Object.entries(r.porStatus).map(([k, v]) => `protese,${k},${v}`), ...Object.entries(r.agPorStatus).map(([k, v]) => `agenda,${k},${v}`)];
    const blob = new Blob([linhas.join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'relatorio.csv'; a.click();
  };

  return (
    <div>
      <div className="grid4">
        <div className="card stat green"><div className="label">Faturamento recebido</div><div className="value">R$ {r.recebido}</div><div className="hint">a receber R$ {r.aReceber}</div></div>
        <div className="card stat amber"><div className="label">Faltas / cancelados</div><div className="value">{r.faltas}</div><div className="hint">de {r.totalAg} agendamentos</div></div>
        <div className="card stat blue"><div className="label">Comparecimento</div><div className="value">{r.taxaComparecimento}%</div><div className="hint">confirmados / total</div></div>
        <div className="card stat dark"><div className="label">Próteses / Pacientes</div><div className="value">{r.totalProteses} / {r.totalPacientes}</div><div className="hint"><button className="btn btn-sm" onClick={csv}>⬇ Exportar CSV</button></div></div>
      </div>
      <div className="grid2">
        <div className="card"><h3>Produção por status</h3>{Object.entries(r.porStatus).map(([k, v]) => <Bar key={k} label={k} value={v} max={maxStatus} />)}</div>
        <div className="card"><h3>Receita por forma</h3>{Object.entries(r.porForma).map(([k, v]) => <Bar key={k} label={k} value={v} max={maxForma} color="#0ea5e9" />)}{Object.keys(r.porForma).length === 0 && <p className="muted small">Sem recebimentos ainda.</p>}</div>
      </div>
    </div>
  );
}
