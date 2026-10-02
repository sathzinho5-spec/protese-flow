import { useState } from 'react';
import { api } from '../api.js';

export default function Config() {
  const [qr, setQr] = useState(null);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const criar = async () => {
    setMsg('Criando instância...');
    try { const r = await api.post('/api/whatsapp/criar'); setQr(r.data); setMsg('Instância criada! Agora busque o QR.'); }
    catch (e) { setMsg(e.response?.data?.error || 'Não foi possível criar a instância.'); }
  };
  const buscarQr = async () => {
    setMsg('Buscando QR...');
    try { const r = await api.get('/api/whatsapp/qrcode'); setQr(r.data); setMsg('Escaneie no WhatsApp > Aparelhos conectados.'); }
    catch (e) { setMsg(e.response?.data?.error || 'Não foi possível buscar o QR Code.'); }
  };
  const configurarWebhook = async () => {
    setBusy(true);
    setMsg('Configurando recebimento de mensagens...');
    try { await api.post('/api/whatsapp/webhook'); setMsg('Webhook configurado. Mensagens recebidas serão enviadas ao painel.'); }
    catch (e) { setMsg('Não foi possível configurar o webhook: ' + (e.response?.data?.error || e.message)); }
    finally { setBusy(false); }
  };

  const qrBase64 = qr?.base64 || qr?.qrcode?.base64 || qr?.data?.base64;
  const qrImage = qrBase64
    ? (qrBase64.startsWith('data:image/') ? qrBase64 : `data:image/png;base64,${qrBase64}`)
    : null;

  return (
    <div>
      <div className="card" style={{ marginBottom: 14 }}>
        <h2 style={{ margin: '0 0 4px' }}>Conectar WhatsApp 📲</h2>
        <p className="muted small">Pareamento via QR Code (Evolution API / Baileys). Sem ele, o painel funciona em modo demonstração.</p>
        <div className="steps">
          <div className="step"><b>1. Evolution online</b><span className="small muted">Use a Evolution já iniciada em localhost:8080; não suba outra cópia na mesma porta.</span></div>
          <div className="step"><b>2. Conectar instância</b><span className="small muted">Se ela já existe, busque o QR Code. Crie uma apenas se ainda não existir.</span></div>
          <div className="step"><b>3. Escanear QR</b><span className="small muted">WhatsApp → Aparelhos conectados → Conectar.</span></div>
        </div>
        <div className="form-row">
          <button className="btn" onClick={criar}>Criar instância (se ainda não existir)</button>
          <button className="btn btn-primary" onClick={buscarQr}>Buscar QR Code</button>
          <button className="btn" onClick={configurarWebhook} disabled={busy}>Configurar webhook</button>
        </div>
        {msg && <p className="small">{msg}</p>}
      </div>
      <div className="card">
        <strong>Webhook</strong>
        <p className="small muted">O botão configura a Evolution local para enviar <code>MESSAGES_UPSERT</code> ao backend. A chave da API em <code>backend/.env</code> precisa ser igual à chave configurada na Evolution.</p>
        {qrImage && <img className="whatsapp-qr" src={qrImage} alt="QR Code para conectar o WhatsApp" />}
        {qr && !qrImage && <pre className="qrbox">{JSON.stringify(qr, null, 2)}</pre>}
      </div>
    </div>
  );
}
