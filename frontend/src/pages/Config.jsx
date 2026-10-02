import { useState } from 'react';
import { api } from '../api.js';

export default function Config() {
  const [qr, setQr] = useState(null);
  const [msg, setMsg] = useState('');

  const criar = async () => {
    setMsg('Criando instância...');
    try { const r = await api.post('/api/whatsapp/criar'); setQr(r.data); setMsg('Instância criada! Agora busque o QR.'); }
    catch (e) { setMsg('Erro: ' + (e.response?.data?.error || e.message)); }
  };
  const buscarQr = async () => {
    setMsg('Buscando QR...');
    try { const r = await api.get('/api/whatsapp/qrcode'); setQr(r.data); setMsg('Escaneie no WhatsApp > Aparelhos conectados.'); }
    catch (e) { setMsg('Suba a Evolution: docker compose up -d — ' + (e.response?.data?.error || e.message)); }
  };

  return (
    <div>
      <div className="card" style={{ marginBottom: 14 }}>
        <h2 style={{ margin: '0 0 4px' }}>Conectar WhatsApp 📲</h2>
        <p className="muted small">Pareamento via QR Code (Evolution API / Baileys). Sem ele, o painel funciona em modo demonstração.</p>
        <div className="steps">
          <div className="step"><b>1. Subir Evolution</b><span className="small muted">Rode na pasta do projeto:</span><br /><code>docker compose up -d</code></div>
          <div className="step"><b>2. Criar instância</b><span className="small muted">Registra a clínica no gateway.</span></div>
          <div className="step"><b>3. Escanear QR</b><span className="small muted">WhatsApp → Aparelhos conectados → Conectar.</span></div>
        </div>
        <div className="form-row">
          <button className="btn btn-primary" onClick={criar}>Criar instância</button>
          <button className="btn" onClick={buscarQr}>Buscar QR Code</button>
        </div>
        {msg && <p className="small">{msg}</p>}
      </div>
      <div className="card">
        <strong>Webhook</strong>
        <p className="small muted">Aponte na Evolution para: <code>http://SEU_IP:3001/webhook/evolution</code> • evento <code>messages.upsert</code></p>
        {qr && <pre className="qrbox">{JSON.stringify(qr, null, 2)}</pre>}
      </div>
    </div>
  );
}
