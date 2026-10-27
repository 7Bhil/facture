const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');

const INVOICE_TYPE_LABELS = {
  FV: 'FACTURE DE VENTE',
  FA: "FACTURE D'AVOIR",
  EV: "FACTURE DE VENTE A L'EXPORTATION",
  EA: "FACTURE D'AVOIR A L'EXPORTATION"
};

function fmt(n) {
  return Math.round(Number(n) || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

async function generateInvoicePdfBuffer(invoice) {
  const qrDataUrl = await QRCode.toDataURL(invoice.qr_code || 'MECEF', {
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 140
  });
  const qrBuffer = Buffer.from(qrDataUrl.split(',')[1], 'base64');

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const pageWidth = doc.page.width - 80; // 515.28
    const startX = 40;
    let y = 35;

    const isTest = (invoice.code_mecef || '').startsWith('TEST');
    const typeLabel = INVOICE_TYPE_LABELS[invoice.invoice_type] || 'FACTURE DE VENTE';
    const counterNum = (invoice.counters || '1/1').split('/')[0];
    const invoiceNum = `${invoice.nim || 'TS01020135'}-${counterNum}`;
    const dateOnly = (invoice.date_time || '').split(' ')[0] || invoice.date_time;

    // 1. Bandeau TEST FACTURE si environnement de test
    if (isTest) {
      doc.rect(startX, y, pageWidth, 22).lineWidth(1.2).stroke('#111111');
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#111111')
        .text('----- TEST FACTURE !!!!! -----', startX, y + 6, { width: pageWidth, align: 'center' });
      y += 30;
    }

    // 2. En-tête Gauche (Vendeur) & Droite (Facture)
    doc.font('Helvetica-Bold').fontSize(14).text(
      invoice.entity === 'SOCOPAO' ? 'SOCOPAO BENIN' : 'AGL BENIN',
      startX, y
    );
    doc.font('Helvetica').fontSize(10).text(`IFU : ${invoice.emitter_ifu || '0202430066359'}`, startX, y + 18);
    doc.font('Helvetica').fontSize(9).text(`Dossier : ${invoice.dossier_ref}`, startX, y + 32);

    doc.font('Helvetica-Bold').fontSize(12).text(typeLabel, startX + 250, y, { width: pageWidth - 250, align: 'right' });
    doc.font('Helvetica').fontSize(9.5).text(`Facture # ${invoiceNum}`, startX + 250, y + 16, { width: pageWidth - 250, align: 'right' });
    doc.text(`Date : ${dateOnly}`, startX + 250, y + 29, { width: pageWidth - 250, align: 'right' });
    doc.text(`Vendeur : SERVICE FACTURATION ${invoice.entity}`, startX + 250, y + 42, { width: pageWidth - 250, align: 'right' });

    if ((invoice.invoice_type === 'FA' || invoice.invoice_type === 'EA') && invoice.original_mecef_code) {
      doc.font('Helvetica-Bold').fontSize(9).text(
        `Réf. de fact. orig. : ${invoice.original_mecef_code}`,
        startX + 200, y + 55, { width: pageWidth - 200, align: 'right' }
      );
      y += 72;
    } else {
      y += 60;
    }

    // 3. Double encadré Point de Vente & Client
    const boxWidth = (pageWidth - 15) / 2;
    const boxHeight = 68;

    // Cadre Gauche
    doc.rect(startX, y, boxWidth, boxHeight).lineWidth(0.6).stroke('#555555');
    doc.font('Helvetica-Oblique').fontSize(8.5).fillColor('#444444');
    doc.text('Adresse', startX + 8, y + 8);
    doc.text('Contact', startX + 8, y + 28);
    doc.text('e-MCF', startX + 8, y + 46);

    doc.font('Helvetica').fontSize(8.5).fillColor('#111111');
    doc.text(invoice.emitter_address || 'Port de Cotonou, Benin', startX + 65, y + 8, { width: boxWidth - 70 });
    doc.text(invoice.emitter_contact || '0144242964', startX + 65, y + 28, { width: boxWidth - 70 });
    doc.font('Helvetica-Bold').text(invoice.nim || 'TS01020135', startX + 65, y + 46);

    // Cadre Droit (CLIENT)
    const rightBoxX = startX + boxWidth + 15;
    doc.rect(rightBoxX, y, boxWidth, boxHeight).lineWidth(0.6).stroke('#555555');
    doc.rect(rightBoxX, y, boxWidth, 16).fill('#444444');
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#FFFFFF')
      .text('CLIENT', rightBoxX + 8, y + 4);

    doc.font('Helvetica-Oblique').fontSize(8.5).fillColor('#444444');
    doc.text('Nom', rightBoxX + 8, y + 20);
    doc.text('IFU', rightBoxX + 8, y + 32);
    doc.text('Adresse', rightBoxX + 8, y + 44);
    doc.text('Contact', rightBoxX + 8, y + 55);

    doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#111111');
    doc.text(invoice.client_name || '-', rightBoxX + 60, y + 20, { width: boxWidth - 65 });
    doc.font('Helvetica').text(invoice.client_ifu || '-', rightBoxX + 60, y + 32);
    doc.text(invoice.client_address || '-', rightBoxX + 60, y + 44, { width: boxWidth - 65 });
    doc.text(invoice.client_contact || '-', rightBoxX + 60, y + 55, { width: boxWidth - 65 });

    y += boxHeight + 12;

    // 4. Mentions Maritimes (Navire & Date d'arrivée)
    if (invoice.vessel_name || invoice.arrival_date || invoice.bl_number) {
      doc.rect(startX, y, pageWidth, 20).fillAndStroke('#F5F5F5', '#BBBBBB');
      doc.fillColor('#111111').font('Helvetica-Bold').fontSize(8.5);
      const mentions = [
        `Navire : ${invoice.vessel_name || 'N/A'}`,
        `Date d'arrivée : ${invoice.arrival_date || 'N/A'}`,
        invoice.bl_number ? `BL / Dossier : ${invoice.bl_number}` : `Dossier : ${invoice.dossier_ref}`
      ].join('     |     ');
      doc.text(mentions, startX + 8, y + 6, { width: pageWidth - 16 });
      y += 28;
    }

    // 5. Tableau des Articles
    const colW = [28, 232, 85, 60, pageWidth - 405];
    const colX = [
      startX,
      startX + colW[0],
      startX + colW[0] + colW[1],
      startX + colW[0] + colW[1] + colW[2],
      startX + colW[0] + colW[1] + colW[2] + colW[3]
    ];

    doc.rect(startX, y, pageWidth, 18).fillAndStroke('#EEEEEE', '#333333');
    doc.fillColor('#111111').font('Helvetica-Bold').fontSize(8.5);
    doc.text('#', colX[0], y + 5, { width: colW[0], align: 'center' });
    doc.text('Nom', colX[1] + 6, y + 5, { width: colW[1] - 12 });
    doc.text('Prix unitaire', colX[2], y + 5, { width: colW[2] - 6, align: 'right' });
    doc.text('Quantité', colX[3], y + 5, { width: colW[3] - 6, align: 'right' });
    doc.text('Montant T.T.C.', colX[4], y + 5, { width: colW[4] - 6, align: 'right' });
    y += 18;

    doc.font('Helvetica').fontSize(8.5);
    const items = invoice.items || [];
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const rowH = 18;
      doc.rect(startX, y, pageWidth, rowH).lineWidth(0.4).stroke('#888888');
      doc.text(String(i + 1), colX[0], y + 5, { width: colW[0], align: 'center' });
      doc.text(it.name || '', colX[1] + 6, y + 5, { width: colW[1] - 12, lineBreak: false });
      doc.text(fmt(it.unit_price_ttc), colX[2], y + 5, { width: colW[2] - 6, align: 'right' });
      doc.text(String(it.quantity), colX[3], y + 5, { width: colW[3] - 6, align: 'right' });
      doc.font('Helvetica-Bold').text(
        `${fmt(it.line_total_ttc)} [${it.tax_group}]`,
        colX[4], y + 5, { width: colW[4] - 6, align: 'right' }
      );
      doc.font('Helvetica');
      y += rowH;
    }

    y += 14;

    // 6. Ventilation des impôts & Total Général
    doc.font('Helvetica-Oblique').fontSize(8).fillColor('#444444')
      .text('--- VENTILATION DES IMPOTS ---', startX, y);

    // Total Box à droite
    doc.moveTo(startX + 335, y + 10).lineTo(startX + pageWidth, y + 10).lineWidth(1.2).stroke('#111111');
    doc.font('Helvetica-Bold').fontSize(13).fillColor('#111111')
      .text(`Total : ${fmt(invoice.total_ttc)}`, startX + 335, y + 16, { width: pageWidth - 335, align: 'right' });
    doc.moveTo(startX + 335, y + 34).lineTo(startX + pageWidth, y + 34).lineWidth(1.2).stroke('#111111');

    y += 12;
    const taxColW = [125, 65, 65, 60];
    const taxX = [
      startX,
      startX + taxColW[0],
      startX + taxColW[0] + taxColW[1],
      startX + taxColW[0] + taxColW[1] + taxColW[2]
    ];
    const taxTableW = 315;

    doc.rect(startX, y, taxTableW, 15).fillAndStroke('#EEEEEE', '#666666');
    doc.fillColor('#111111').font('Helvetica-Bold').fontSize(8);
    doc.text('Groupe', taxX[0] + 4, y + 4);
    doc.text('Total', taxX[1], y + 4, { width: taxColW[1] - 4, align: 'right' });
    doc.text('Imposable', taxX[2], y + 4, { width: taxColW[2] - 4, align: 'right' });
    doc.text('Impôt', taxX[3], y + 4, { width: taxColW[3] - 4, align: 'right' });
    y += 15;

    const taxRows = [];
    if (invoice.taa > 0) taxRows.push(['A - EXONERE (0%)', fmt(invoice.taa), fmt(invoice.taa), '0']);
    if (invoice.tab > 0) taxRows.push(['B - TAXABLE (18%)', fmt(invoice.tab), fmt(invoice.hab), fmt(invoice.vab)]);
    if (invoice.tac > 0) taxRows.push(['C - EXPORT (0%)', fmt(invoice.tac), fmt(invoice.tac), '0']);
    if (invoice.tad > 0) taxRows.push(['D - EXCEPTION (18%)', fmt(invoice.tad), fmt(invoice.had), fmt(invoice.vad)]);
    if (invoice.tae > 0) taxRows.push(['E - TPS (0%)', fmt(invoice.tae), fmt(invoice.tae), '0']);
    if (invoice.taf > 0) taxRows.push(['F - RESERVE (0%)', fmt(invoice.taf), fmt(invoice.taf), '0']);

    doc.font('Helvetica').fontSize(8);
    for (const tr of taxRows) {
      doc.rect(startX, y, taxTableW, 15).lineWidth(0.4).stroke('#888888');
      doc.text(tr[0], taxX[0] + 4, y + 4);
      doc.text(tr[1], taxX[1], y + 4, { width: taxColW[1] - 4, align: 'right' });
      doc.text(tr[2], taxX[2], y + 4, { width: taxColW[2] - 4, align: 'right' });
      doc.text(tr[3], taxX[3], y + 4, { width: taxColW[3] - 4, align: 'right' });
      y += 15;
    }

    y += 14;

    // 7. Répartition des paiements
    doc.font('Helvetica-Oblique').fontSize(8).fillColor('#444444')
      .text('--- REPARTITION DES PAIEMENTS ---', startX, y);
    y += 12;

    doc.rect(startX, y, pageWidth, 15).fillAndStroke('#EEEEEE', '#666666');
    doc.fillColor('#111111').font('Helvetica-Bold').fontSize(8);
    doc.text('Type de paiement', startX + 6, y + 4);
    doc.text('Payé', startX + 350, y + 4, { width: pageWidth - 356, align: 'right' });
    y += 15;

    doc.rect(startX, y, pageWidth, 16).lineWidth(0.4).stroke('#888888');
    doc.font('Helvetica').fontSize(8.5);
    doc.text(invoice.payment_type || 'VIREMENT', startX + 6, y + 4);
    doc.font('Helvetica-Bold').text(fmt(invoice.total_ttc), startX + 350, y + 4, { width: pageWidth - 356, align: 'right' });
    y += 28;

    // 8. Éléments de sécurité de la facture normalisée
    doc.font('Helvetica-Oblique').fontSize(8).fillColor('#444444')
      .text('--- ELEMENTS DE SECURITE DE LA FACTURE NORMALISEE ---', startX, y);
    y += 12;

    const secBoxH = isTest ? 130 : 105;
    doc.rect(startX, y, pageWidth, secBoxH).lineWidth(0.8).stroke('#333333');

    let innerY = y + 8;
    if (isTest) {
      doc.rect(startX + 8, innerY, pageWidth - 16, 18).lineWidth(0.8).stroke('#111111');
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#111111')
        .text('----- TEST FACTURE !!!!! -----', startX + 8, innerY + 5, { width: pageWidth - 16, align: 'center' });
      innerY += 24;
    }

    // QR Code à gauche
    doc.image(qrBuffer, startX + 45, innerY, { width: 88, height: 88 });

    // Infos MECeF à droite
    const infoX = startX + 210;
    const infoW = pageWidth - 235;
    doc.font('Helvetica').fontSize(8.5).fillColor('#333333')
      .text('Code MECeF/DGI', infoX, innerY + 8, { width: infoW, align: 'center' });
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#111111')
      .text(invoice.code_mecef || '', infoX, innerY + 20, { width: infoW, align: 'center' });

    doc.font('Helvetica').fontSize(8.5).text('MECeF NIM :', infoX, innerY + 42);
    doc.font('Helvetica-Bold').text(invoice.nim || '', infoX, innerY + 42, { width: infoW, align: 'right' });

    doc.font('Helvetica').text('MECeF Compteurs :', infoX, innerY + 56);
    doc.font('Helvetica-Bold').text(invoice.counters || '', infoX, innerY + 56, { width: infoW, align: 'right' });

    doc.font('Helvetica').text('MECeF Heure :', infoX, innerY + 70);
    doc.font('Helvetica-Bold').text(invoice.date_time || '', infoX, innerY + 70, { width: infoW, align: 'right' });

    doc.end();
  });
}

module.exports = { generateInvoicePdfBuffer };
