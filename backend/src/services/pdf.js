import PDFDocument from 'pdfkit';

function header(doc, titulo) {
  const nome = process.env.CLINICA_NOME || 'Clínica de Prótese Dentária';
  doc.fontSize(18).text(`🦷 ${nome}`, { align: 'center' });
  doc.fontSize(10).fillColor('#555').text(`${process.env.CLINICA_ENDERECO || ''} • ${process.env.CLINICA_HORARIO || ''}`, { align: 'center' });
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
    header(doc, 'ORÇAMENTO — PRÓTESE DENTÁRIA');
    row(doc, 'Paciente', paciente?.nome);
    row(doc, 'WhatsApp', paciente?.telefone);
    row(doc, 'Tipo de prótese', protese.tipo);
    row(doc, 'Status', protese.status);
    row(doc, 'Previsão', protese.previsao || 'a combinar');
    row(doc, 'Valor total', `R$ ${protese.valor || 0}`);
    const pago = lancamentos.filter(l => l.status === 'pago').reduce((s, l) => s + Number(l.valor || 0), 0);
    row(doc, 'Pago', `R$ ${pago}`);
    row(doc, 'Saldo', `R$ ${Number(protese.valor || 0) - pago}`);
    doc.moveDown();
    doc.fontSize(10).fillColor('#555').text('Validade do orçamento: 30 dias. Valores podem variar após avaliação clínica. Garantia de 1 ano contra defeitos de fabricação (não cobre quebra por queda/mordida inadequada).');
    doc.moveDown();
    doc.fillColor('#000').fontSize(11).text('Assinatura da clínica: ___________________________');
    doc.text('Assinatura do paciente: ___________________________');
    doc.moveDown().fontSize(9).fillColor('#777').text(`Emitido em ${new Date().toLocaleString()} • PróteseFácil`);
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
    row(doc, 'Recebido de', paciente?.nome || lanc.descricao);
    row(doc, 'Valor', `R$ ${lanc.valor}`);
    row(doc, 'Referente a', `${lanc.descricao} ${protese ? `(${protese.tipo})` : ''}`);
    row(doc, 'Forma', lanc.forma || '—');
    row(doc, 'Data', lanc.data || new Date().toISOString().slice(0, 10));
    row(doc, 'Status', lanc.status);
    doc.moveDown();
    doc.fontSize(11).text('Assinatura: ___________________________');
    doc.moveDown().fontSize(9).fillColor('#777').text(`Recibo ${lanc.id} • Emitido em ${new Date().toLocaleString()} • PróteseFácil`);
    doc.end();
  });
}
