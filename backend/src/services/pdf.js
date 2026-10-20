import PDFDocument from 'pdfkit';
import { config } from '../config.js';

function header(doc, titulo) {
  doc.fontSize(18).text(config.business.name, { align: 'center' });
  const details = [config.business.tagline, config.business.address, config.business.hours].filter(Boolean).join(' • ');
  if (details) doc.fontSize(10).fillColor('#555').text(details, { align: 'center' });
  doc.moveDown();
  doc.fillColor('#000').fontSize(14).text(titulo, { align: 'center', underline: true });
  doc.moveDown();
}
function row(doc, k, v) {
  doc.fontSize(11).fillColor('#333').text(`${k}: `, { continued: true }).fillColor('#000').text(String(v ?? '—'));
}

export function orcamentoPDF({ protese, paciente, lancamentos = [] }) {
  return new Promise((resolve) => {
    const doc = new PDFDocument({ margin: 40 });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    header(doc, 'PROPOSTA COMERCIAL');
    row(doc, 'Cliente', paciente?.empresa || paciente?.nome);
    row(doc, 'Contato', paciente?.telefone);
    row(doc, 'Projeto', protese.tipo);
    row(doc, 'Etapa', protese.status);
    row(doc, 'Previsão de entrega', protese.previsao || 'a combinar');
    row(doc, 'Investimento', `R$ ${protese.valor || 0}`);
    const pago = lancamentos.filter(l => l.status === 'pago').reduce((s, l) => s + Number(l.valor || 0), 0);
    row(doc, 'Pago', `R$ ${pago}`);
    row(doc, 'Saldo', `R$ ${Number(protese.valor || 0) - pago}`);
    doc.moveDown();
    doc.fontSize(10).fillColor('#555').text('Escopo, prazos e condições finais devem ser confirmados entre as partes antes do início do projeto.');
    doc.moveDown();
    doc.fillColor('#000').fontSize(11).text('Seth Digital: _________________________________');
    doc.text('Cliente: _____________________________________');
    doc.moveDown().fontSize(9).fillColor('#777').text(`Emitido em ${new Date().toLocaleString()} • ${config.business.name}`);
    doc.end();
  });
}

export function reciboPDF({ lanc, paciente, protese }) {
  return new Promise((resolve) => {
    const doc = new PDFDocument({ margin: 40 });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    header(doc, 'RECIBO DE PAGAMENTO');
    row(doc, 'Recebido de', paciente?.empresa || paciente?.nome || lanc.descricao);
    row(doc, 'Valor', `R$ ${lanc.valor}`);
    row(doc, 'Referente a', `${lanc.descricao} ${protese ? `(${protese.tipo})` : ''}`);
    row(doc, 'Forma', lanc.forma || '—');
    row(doc, 'Data', lanc.data || new Date().toISOString().slice(0, 10));
    row(doc, 'Status', lanc.status);
    doc.moveDown();
    doc.fontSize(11).text('Assinatura: ___________________________');
    doc.moveDown().fontSize(9).fillColor('#777').text(`Recibo ${lanc.id} • Emitido em ${new Date().toLocaleString()} • ${config.business.name}`);
    doc.end();
  });
}
