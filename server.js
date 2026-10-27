require('dotenv').config();
const express = require('express');
const cors = require('cors');
const db = require('./db');
const { generateInvoicePdfBuffer } = require('./pdfGenerator');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '5mb' }));

function getEntityConfig(entity) {
  const norm = (entity || 'AGL').toUpperCase();
  const baseUrl = process.env.DGI_API_BASE_URL || 'https://developper.impots.bj/sygmef-emcf';
  if (norm === 'SOCOPAO') {
    return {
      entity: 'SOCOPAO',
      token: process.env.SOCOPAO_API_TOKEN || process.env.AGL_API_TOKEN,
      ifu: process.env.SOCOPAO_IFU || '0202430066359',
      nim: process.env.SOCOPAO_NIM || 'TS01020135',
      baseUrl
    };
  }
  return {
    entity: 'AGL',
    token: process.env.AGL_API_TOKEN,
    ifu: process.env.AGL_IFU || '0202430066359',
    nim: process.env.AGL_NIM || 'TS01020135',
    baseUrl
  };
}

function getFullInvoiceById(id) {
  const facture = db.prepare('SELECT * FROM factures_v2 WHERE id = ?').get(id);
  if (!facture) return null;
  const items = db.prepare('SELECT * FROM facture_items WHERE facture_id = ? ORDER BY line_number ASC').all(id);
  return { ...facture, items };
}

// 1. Statut e-MCF et factures en attente sur la DGI
app.get('/api/emcf-status/:entity', async (req, res) => {
  try {
    const cfg = getEntityConfig(req.params.entity);
    if (!cfg.token) {
      return res.status(400).json({ success: false, message: `Jeton API manquant pour ${cfg.entity}` });
    }

    const [infoRes, pendingRes] = await Promise.all([
      fetch(`${cfg.baseUrl}/api/info/status`, {
        headers: { Authorization: `Bearer ${cfg.token}`, Accept: 'application/json' }
      }),
      fetch(`${cfg.baseUrl}/api/invoice`, {
        headers: { Authorization: `Bearer ${cfg.token}`, Accept: 'application/json' }
      })
    ]);

    const infoData = infoRes.ok ? await infoRes.json() : null;
    const pendingData = pendingRes.ok ? await pendingRes.json() : null;

    const emcfInfo = infoData && Array.isArray(infoData.emcfList) && infoData.emcfList.length > 0
      ? infoData.emcfList[0]
      : {};

    res.json({
      success: true,
      entity: cfg.entity,
      status: Boolean(infoData && infoData.status),
      ifu: (infoData && infoData.ifu) || cfg.ifu,
      nim: (infoData && infoData.nim) || cfg.nim,
      tokenValid: infoData ? infoData.tokenValid : null,
      serverDateTime: infoData ? infoData.serverDateTime : null,
      shopAddress: [emcfInfo.address1, emcfInfo.address3].filter(Boolean).join(', ') || 'Port de Cotonou, Benin',
      shopContact: [emcfInfo.contact1, emcfInfo.contact2].filter(Boolean).join(' / ') || '',
      pendingRequestsCount: pendingData ? (pendingData.pendingRequestsCount || 0) : 0,
      pendingRequestsList: pendingData ? (pendingData.pendingRequestsList || []) : []
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 2. Purge / Annulation des factures en attente sur la DGI
app.post('/api/emcf-pending/:entity/cancel', async (req, res) => {
  try {
    const cfg = getEntityConfig(req.params.entity);
    const { uids = [] } = req.body;
    const cancelled = [];

    for (const uid of uids) {
      const cancelRes = await fetch(`${cfg.baseUrl}/api/invoice/${uid}/cancel`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${cfg.token}`, Accept: 'application/json' }
      });
      if (cancelRes.ok) {
        cancelled.push(uid);
      }
    }

    res.json({
      success: true,
      cancelledCount: cancelled.length,
      cancelled
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 3. Recherche client par IFU ou Nom dans l'annuaire local
app.get('/api/clients/lookup', (req, res) => {
  try {
    const { ifu, q } = req.query;
    if (ifu) {
      const client = db.prepare('SELECT * FROM clients WHERE ifu = ?').get(ifu.trim());
      return res.json({ success: true, client: client || null });
    }
    if (q) {
      const clients = db.prepare('SELECT * FROM clients WHERE name LIKE ? OR ifu LIKE ? LIMIT 10')
        .all(`%${q.trim()}%`, `%${q.trim()}%`);
      return res.json({ success: true, clients });
    }
    const allClients = db.prepare('SELECT * FROM clients ORDER BY updated_at DESC LIMIT 20').all();
    res.json({ success: true, clients: allClients });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 4. Catalogue des rubriques préprogrammées AGL / SOCOPAO
app.get('/api/catalog', (req, res) => {
  try {
    const items = db.prepare('SELECT * FROM catalog_items ORDER BY id ASC').all();
    res.json({ success: true, items });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 5. Liste et détail des factures normalisées
app.get('/api/invoices', (req, res) => {
  try {
    const { entity, type, search } = req.query;
    let sql = 'SELECT * FROM factures_v2 WHERE 1=1';
    const params = [];

    if (entity) {
      sql += ' AND entity = ?';
      params.push(entity.toUpperCase());
    }
    if (type) {
      sql += ' AND invoice_type = ?';
      params.push(type.toUpperCase());
    }
    if (search) {
      sql += ' AND (dossier_ref LIKE ? OR client_name LIKE ? OR code_mecef LIKE ? OR vessel_name LIKE ?)';
      const like = `%${search.trim()}%`;
      params.push(like, like, like, like);
    }

    sql += ' ORDER BY id DESC LIMIT 100';
    const rows = db.prepare(sql).all(...params);
    const fullRows = rows.map((row) => ({
      ...row,
      items: db.prepare('SELECT * FROM facture_items WHERE facture_id = ? ORDER BY line_number ASC').all(row.id)
    }));

    res.json({ success: true, invoices: fullRows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});


app.get('/api/invoices/:id/pdf', async (req, res) => {
  try {
    const inv = getFullInvoiceById(Number(req.params.id));
    if (!inv) {
      return res.status(404).json({ success: false, message: 'Facture introuvable.' });
    }
    const pdfBuffer = await generateInvoicePdfBuffer(inv);
    const safeRef = (inv.dossier_ref || 'FACTURE').replace(/[^A-Za-z0-9_-]/g, '_');
    const filename = `Facture_${inv.entity}_${safeRef}_${inv.code_mecef || ''}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(pdfBuffer);
  } catch (err) {
    console.error('Erreur generation PDF:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get('/api/invoices/:id', (req, res) => {
  try {
    const inv = getFullInvoiceById(Number(req.params.id));
    if (!inv) {
      return res.status(404).json({ success: false, message: 'Facture introuvable.' });
    }
    res.json({ success: true, data: inv });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 6. Emission et Normalisation e-MECeF DGI
app.post('/api/normalize', async (req, res) => {
  try {
    const {
      entity = 'AGL',
      dossier_ref = '',
      invoice_type = 'FV',
      original_mecef_code = '',
      client = {},
      vessel_name = '',
      arrival_date = '',
      bl_number = '',
      custom_message = '',
      aib_type = null,
      payment_type = 'VIREMENT',
      items = [],
      force = false
    } = req.body;

    const normEntity = entity.trim().toUpperCase();
    const normDossier = dossier_ref.trim();
    const normType = invoice_type.trim().toUpperCase();

    if (!normDossier) {
      return res.status(400).json({ success: false, message: 'Le numero de dossier / facture interne est obligatoire.' });
    }

    if (!['FV', 'FA', 'EV', 'EA'].includes(normType)) {
      return res.status(400).json({ success: false, message: `Type de facture invalide: ${normType}` });
    }

    const clientName = (client.name || '').trim();
    const clientIfu = (client.ifu || '').trim();
    const clientAddress = (client.address || '').trim();
    const clientContact = (client.contact || '').trim();

    if (!clientName) {
      return res.status(400).json({ success: false, message: 'La raison sociale / nom du client est obligatoire.' });
    }

    if (clientIfu && !/^\d{13}$/.test(clientIfu)) {
      return res.status(400).json({
        success: false,
        message: 'L IFU du client doit comporter exactement 13 chiffres numeriques (ou rester vide pour un client etranger).'
      });
    }

    // Verification de la reference originale pour les factures d'avoir (FA, EA)
    const cleanedOrigMecef = (original_mecef_code || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    if (normType === 'FA' || normType === 'EA') {
      if (cleanedOrigMecef.length !== 24) {
        return res.status(400).json({
          success: false,
          message: `Pour une facture d avoir (${normType}), le Code MECeF de la facture originale est obligatoire et doit comporter exactement 24 caracteres alphanumeriques (actuellement: ${cleanedOrigMecef.length}).`
        });
      }
    }

    // Validation de la liste d'articles
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'La facture doit contenir au moins un article.'
      });
    }

    const validatedItems = [];
    let computedTotalTtc = 0;

    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const name = (it.name || '').trim();
      const price = Math.round(Number(it.unit_price_ttc));
      const quantity = Number(it.quantity);
      const taxGroup = (it.tax_group || 'B').trim().toUpperCase();
      const taxSpecific = Math.round(Number(it.tax_specific || 0));

      if (!name) {
        return res.status(400).json({
          success: false,
          message: `Le libelle de la ligne #${i + 1} est obligatoire.`
        });
      }
      if (!price || price <= 0) {
        return res.status(400).json({
          success: false,
          message: `Le prix unitaire TTC de la ligne "${name}" doit etre superieur a 0.`
        });
      }
      if (!quantity || quantity <= 0) {
        return res.status(400).json({
          success: false,
          message: `La quantite de la ligne "${name}" doit etre superieure a 0.`
        });
      }
      if (!['A', 'B', 'C', 'D', 'E', 'F'].includes(taxGroup)) {
        return res.status(400).json({
          success: false,
          message: `Groupe de taxation invalide (${taxGroup}) sur la ligne "${name}".`
        });
      }

      const lineTotal = Math.round(price * quantity) + taxSpecific;
      computedTotalTtc += lineTotal;

      validatedItems.push({
        line_number: i + 1,
        code: (it.code || `ART-0${i + 1}`).trim(),
        name,
        tax_group: taxGroup,
        unit_price_ttc: price,
        quantity,
        tax_specific: taxSpecific,
        line_total_ttc: lineTotal
      });
    }

    // Controle d'idempotence (Entite + Dossier + Type)
    const existing = db.prepare(
      'SELECT * FROM factures_v2 WHERE entity = ? AND dossier_ref = ? AND invoice_type = ?'
    ).get(normEntity, normDossier, normType);

    if (existing) {
      if (existing.status === 'NORMALISE' && !force) {
        const fullExisting = getFullInvoiceById(existing.id);
        return res.json({
          success: true,
          already_normalized: true,
          requires_confirmation: false,
          message: `Ce dossier (${normDossier} - ${normType}) a deja ete normalise (Code MECeF: ${existing.code_mecef}). Certificat existant restitue sans double envoi.`,
          data: fullExisting
        });
      }
    }

    // Verification d'un doublon potentiel sur même client et même montant
    if (!force && !existing) {
      const similar = db.prepare(
        'SELECT * FROM factures_v2 WHERE entity = ? AND client_name = ? AND total_ttc = ? AND invoice_type = ? AND status = \'NORMALISE\''
      ).get(normEntity, clientName, computedTotalTtc, normType);

      if (similar) {
        return res.json({
          success: false,
          requires_confirmation: true,
          message: `Une facture normalisee pour le client "${clientName}" avec le meme montant exact (${computedTotalTtc.toLocaleString('fr-FR')} FCFA) existe deja sous la reference "${similar.dossier_ref}" (Code MECeF: ${similar.code_mecef}). Confirmez-vous qu il s agit bien d une nouvelle operation distincte ?`,
          existing: similar
        });
      }
    }

    const cfg = getEntityConfig(normEntity);
    if (!cfg.token) {
      return res.status(500).json({
        success: false,
        message: `Aucun jeton API DGI configure pour l entite ${normEntity}.`
      });
    }

    // Construction du payload officiel InvoiceRequestDataDto conforme v1_swagger.json
    const dgiItems = validatedItems.map((it) => {
      const dto = {
        code: it.code,
        name: it.name,
        price: it.unit_price_ttc,
        quantity: it.quantity,
        taxGroup: it.tax_group
      };
      if (it.tax_specific > 0) {
        dto.taxSpecific = it.tax_specific;
      }
      return dto;
    });

    const dgiPayload = {
      ifu: cfg.ifu,
      type: normType,
      items: dgiItems,
      client: {
        ifu: clientIfu || null,
        name: clientName,
        address: clientAddress || 'Cotonou, Benin',
        contact: clientContact || null
      },
      operator: {
        id: '01',
        name: `SERVICE FACTURATION ${normEntity}`
      },
      payment: [
        {
          name: payment_type || 'VIREMENT',
          amount: computedTotalTtc
        }
      ]
    };

    if (aib_type === 'A' || aib_type === 'B') {
      dgiPayload.aib = aib_type;
    }

    // Champ reference envoye UNIQUEMENT pour FA et EA (24 caracteres du Code MECeF original)
    if (normType === 'FA' || normType === 'EA') {
      dgiPayload.reference = cleanedOrigMecef;
    }

    // Etape 1 DGI : POST /api/invoice
    const postRes = await fetch(`${cfg.baseUrl}/api/invoice`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cfg.token}`,
        Accept: 'application/json'
      },
      body: JSON.stringify(dgiPayload)
    });

    if (!postRes.ok) {
      const errText = await postRes.text();
      return res.status(502).json({
        success: false,
        message: `Rejet HTTP DGI lors de la soumission (${postRes.status}): ${errText}`
      });
    }

    const postData = await postRes.json();

    if (postData.errorCode || !postData.uid) {
      return res.status(400).json({
        success: false,
        message: `Rejet metier DGI (Code ${postData.errorCode || 'Inconnu'}): ${postData.errorDesc || JSON.stringify(postData)}`
      });
    }

    const uid = postData.uid;

    // Etape 2 DGI : PUT /api/invoice/{uid}/confirm
    const confirmRes = await fetch(`${cfg.baseUrl}/api/invoice/${uid}/confirm`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${cfg.token}`,
        Accept: 'application/json'
      }
    });

    if (!confirmRes.ok) {
      const errText = await confirmRes.text();
      return res.status(502).json({
        success: false,
        message: `Echec de confirmation DGI (${confirmRes.status}): ${errText}`
      });
    }

    const secData = await confirmRes.json();
    if (secData.errorCode || !secData.codeMECeFDGI) {
      return res.status(400).json({
        success: false,
        message: `Rejet DGI lors de la finalisation (Code ${secData.errorCode}): ${secData.errorDesc || JSON.stringify(secData)}`
      });
    }

    // Sauvegarde atomique SQLite
    const saveTx = db.transaction(() => {
      const upsertFacture = db.prepare(`
        INSERT INTO factures_v2 (
          entity, dossier_ref, invoice_type, original_mecef_code,
          client_ifu, client_name, client_address, client_contact,
          vessel_name, arrival_date, bl_number, custom_message,
          aib_type, payment_type,
          taa, tab, tac, tad, tae, taf,
          hab, had, vab, vad, aib_amount, ts_amount, total_ttc,
          status, dgi_uid, nim, code_mecef, counters, date_time, qr_code,
          emitter_ifu, emitter_address, emitter_contact
        ) VALUES (
          ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?,
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?, ?,
          'NORMALISE', ?, ?, ?, ?, ?, ?,
          ?, ?, ?
        )
        ON CONFLICT(entity, dossier_ref, invoice_type) DO UPDATE SET
          original_mecef_code = excluded.original_mecef_code,
          client_ifu = excluded.client_ifu,
          client_name = excluded.client_name,
          client_address = excluded.client_address,
          client_contact = excluded.client_contact,
          vessel_name = excluded.vessel_name,
          arrival_date = excluded.arrival_date,
          bl_number = excluded.bl_number,
          custom_message = excluded.custom_message,
          aib_type = excluded.aib_type,
          payment_type = excluded.payment_type,
          taa = excluded.taa,
          tab = excluded.tab,
          tac = excluded.tac,
          tad = excluded.tad,
          tae = excluded.tae,
          taf = excluded.taf,
          hab = excluded.hab,
          had = excluded.had,
          vab = excluded.vab,
          vad = excluded.vad,
          aib_amount = excluded.aib_amount,
          ts_amount = excluded.ts_amount,
          total_ttc = excluded.total_ttc,
          status = 'NORMALISE',
          dgi_uid = excluded.dgi_uid,
          nim = excluded.nim,
          code_mecef = excluded.code_mecef,
          counters = excluded.counters,
          date_time = excluded.date_time,
          qr_code = excluded.qr_code
      `);

      upsertFacture.run(
        normEntity,
        normDossier,
        normType,
        cleanedOrigMecef || null,
        clientIfu || null,
        clientName,
        clientAddress || 'Cotonou, Benin',
        clientContact || null,
        vessel_name.trim() || null,
        arrival_date.trim() || null,
        bl_number.trim() || null,
        custom_message.trim() || null,
        aib_type || null,
        payment_type || 'VIREMENT',
        postData.taa || 0,
        postData.tab || 0,
        postData.tac || 0,
        postData.tad || 0,
        postData.tae || 0,
        postData.taf || 0,
        postData.hab || 0,
        postData.had || 0,
        postData.vab || 0,
        postData.vad || 0,
        postData.aib || 0,
        postData.ts || 0,
        postData.total || computedTotalTtc,
        uid,
        secData.nim,
        secData.codeMECeFDGI,
        secData.counters,
        secData.dateTime,
        secData.qrCode,
        cfg.ifu,
        'Port de Cotonou, Zone Portuaire, Cotonou',
        '0144242964 / 7BHIL.CHITOU7@GMAIL.COM'
      );

      const savedRow = db.prepare(
        'SELECT id FROM factures_v2 WHERE entity = ? AND dossier_ref = ? AND invoice_type = ?'
      ).get(normEntity, normDossier, normType);

      db.prepare('DELETE FROM facture_items WHERE facture_id = ?').run(savedRow.id);

      const insertItem = db.prepare(`
        INSERT INTO facture_items (
          facture_id, line_number, code, name, tax_group, unit_price_ttc, quantity, tax_specific, line_total_ttc
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const it of validatedItems) {
        insertItem.run(
          savedRow.id,
          it.line_number,
          it.code,
          it.name,
          it.tax_group,
          it.unit_price_ttc,
          it.quantity,
          it.tax_specific,
          it.line_total_ttc
        );
      }

      if (clientIfu) {
        db.prepare(`
          INSERT INTO clients (ifu, name, address, contact, updated_at)
          VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
          ON CONFLICT(ifu) DO UPDATE SET
            name = excluded.name,
            address = excluded.address,
            contact = excluded.contact,
            updated_at = CURRENT_TIMESTAMP
        `).run(clientIfu, clientName, clientAddress || 'Cotonou, Benin', clientContact || null);
      }

      return savedRow.id;
    });

    const savedId = saveTx();
    const fullSaved = getFullInvoiceById(savedId);

    res.json({
      success: true,
      already_normalized: false,
      message: 'Facture normalisee et certifiee avec succes par la DGI.',
      data: fullSaved
    });
  } catch (err) {
    console.error('Erreur /api/normalize:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Serveur Express e-MECeF V2 actif sur http://127.0.0.1:${PORT}`);
});
