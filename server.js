/**
 * Backend Express de Normalisation e-MECeF
 * Intégration directe avec l'API e-MECeF (SyGMEF / DGI Bénin)
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const Database = require('better-sqlite3');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Initialisation de la persistance SQLite locale
const dbPath = path.join(__dirname, 'factures.db');
const db = new Database(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS factures (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entity TEXT NOT NULL,
    invoice_type TEXT NOT NULL,
    reference TEXT NOT NULL,
    client_ifu TEXT,
    client_name TEXT NOT NULL,
    client_address TEXT,
    vessel_name TEXT,
    arrival_date TEXT,
    amount_ht REAL NOT NULL,
    amount_tva REAL NOT NULL,
    amount_debours REAL NOT NULL,
    amount_total REAL NOT NULL,
    status TEXT NOT NULL,
    nim TEXT,
    code_mecef TEXT,
    counters TEXT,
    date_time TEXT,
    qr_code TEXT,
    dgi_uid TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(entity, reference)
  )
`);

// Consultation de l'historique des factures
app.get('/api/invoices', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM factures ORDER BY id DESC LIMIT 50').all();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Appel e-MECeF DGI : Soumission (POST /api/invoice) puis Confirmation (PUT /api/invoice/{uid}/confirm)
async function callEmcefDgi(payload, token, baseUrl) {
  // 1. Soumission
  const postUrl = `${baseUrl}/api/invoice`;
  const postRes = await fetch(postUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!postRes.ok) {
    const errText = await postRes.text();
    throw new Error(`DGI Rejet POST (${postRes.status}): ${errText}`);
  }

  const postData = await postRes.json();
  const uid = postData.uid;
  if (!uid) {
    throw new Error(`DGI Reponse sans UID: ${JSON.stringify(postData)}`);
  }

  // 2. Confirmation
  const confirmUrl = `${baseUrl}/api/invoice/${uid}/confirm`;
  const confirmRes = await fetch(confirmUrl, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json'
    }
  });

  if (!confirmRes.ok) {
    const errText = await confirmRes.text();
    throw new Error(`DGI Rejet Confirmation (${confirmRes.status}): ${errText}`);
  }

  const security = await confirmRes.json();
  return {
    uid,
    summary: postData,
    security
  };
}

// Endpoint POST /api/normalize
app.post('/api/normalize', async (req, res) => {
  try {
    const {
      entity = 'AGL',
      reference = '',
      client_ifu = '',
      client_name = '',
      client_address = '',
      vessel_name = '',
      arrival_date = '',
      service_description = 'PRESTATIONS MARITIMES ET TRANSIT',
      amount_service = 0,
      debours_description = 'DEBOURS DOUANE ET FRAIS PORTUAIRES AVANCES',
      amount_debours = 0,
      has_tva = true,
      force = false
    } = req.body;

    const servNum = Math.round(Number(amount_service)) || 0;
    const debNum = Math.round(Number(amount_debours)) || 0;
    const tva = has_tva ? Math.round(servNum * 0.18) : 0;
    const total = servNum + tva + debNum;

    // 1. Controle d'idempotence
    const existing = db.prepare('SELECT * FROM factures WHERE entity = ? AND reference = ?').get(entity, reference);

    if (existing) {
      if (existing.status === 'NORMALISE') {
        return res.json({
          success: true,
          already_normalized: true,
          message: 'Facture deja normalisee avec succes. Aucune re-soumission effectuee.',
          data: {
            ...existing,
            amount_service: existing.amount_ht,
            amount_tva: existing.amount_tva,
            amount_debours: existing.amount_debours,
            amount_total: existing.amount_total
          }
        });
      } else if (!force) {
        return res.json({
          success: false,
          requires_confirmation: true,
          message: `Une facture avec la reference "${reference}" existe deja dans le systeme. Confirmez-vous qu'il ne s'agit pas d'un doublon ?`,
          existing
        });
      }
    }

    // 2. Recuperation des identifiants API DGI selon l'entite
    const token = entity === 'AGL' ? process.env.AGL_API_TOKEN : process.env.SOCOPAO_API_TOKEN;
    const emitterIfu = entity === 'AGL' ? process.env.AGL_IFU : process.env.SOCOPAO_IFU;
    const baseUrl = process.env.DGI_API_BASE_URL || 'https://developper.impots.bj/sygmef-emcf';

    if (!token) {
      throw new Error(`Aucun jeton API configure pour l'entite ${entity}`);
    }

    // 3. Validation des articles
    if (servNum <= 0 && debNum <= 0) {
      return res.status(400).json({
        success: false,
        message: 'La facture doit contenir au moins un montant supérieur à zéro (prestation HT ou débours).'
      });
    }

    // 4. Construction du payload normalise e-MECeF (conforme v1_swagger.json)
    const items = [];
    if (servNum > 0) {
      items.push({
        code: 'SRV-01',
        name: `PRESTATIONS MARITIMES (ESCALE: ${vessel_name || 'N/A'})`,
        price: servNum + tva, // e-MECeF attend le prix TTC unitaire
        quantity: 1,
        taxGroup: 'B' // Taxable 18%
      });
    }

    if (debNum > 0) {
      items.push({
        code: 'DEB-01',
        name: debours_description.trim() || 'DEBOURS SANS TVA', 
        price: debNum,
        quantity: 1,
        taxGroup: 'A' // Exonere / Debours sans TVA
      });
    }

    const dgiPayload = {
      ifu: emitterIfu,
      aib: 'A',
      type: 'FV', // Facture de Vente
      items,
      client: {
        ifu: client_ifu.trim().length === 13 ? client_ifu.trim() : null,
        name: client_name.trim(),
        address: client_address.trim() || 'Cotonou, Benin',
        contact: null
      },
      operator: {
        name: 'OPERATEUR FACTURATION AGL'
      },
      payment: [
        {
          name: 'AUTRE',
          amount: total
        }
      ],
      reference
    };

    // 4. Transmission et certification par le serveur DGI e-MECeF
    console.log(`Soumission vers e-MECeF (${entity} / ${reference})...`);
    const dgiResult = await callEmcefDgi(dgiPayload, token, baseUrl);
    const sec = dgiResult.security;

    // 5. Enregistrement en base de donnees locale
    const upsert = db.prepare(`
      INSERT INTO factures (
        entity, invoice_type, reference, client_ifu, client_name, client_address,
        vessel_name, arrival_date, amount_ht, amount_tva, amount_debours, amount_total,
        status, nim, code_mecef, counters, date_time, qr_code, dgi_uid
      ) VALUES (?, 'FV', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'NORMALISE', ?, ?, ?, ?, ?, ?)
      ON CONFLICT(entity, reference) DO UPDATE SET
        status = 'NORMALISE',
        nim = excluded.nim,
        code_mecef = excluded.code_mecef,
        counters = excluded.counters,
        date_time = excluded.date_time,
        qr_code = excluded.qr_code,
        dgi_uid = excluded.dgi_uid
    `);

    upsert.run(
      entity, reference, client_ifu, client_name, client_address,
      vessel_name, arrival_date, servNum, tva, debNum, total,
      sec.nim, sec.codeMECeFDGI, sec.counters, sec.dateTime, sec.qrCode, dgiResult.uid
    );

    return res.json({
      success: true,
      already_normalized: false,
      message: 'Facture certifiee avec succes par le serveur e-MECeF de la DGI.',
      data: {
        entity,
        reference,
        emitter_ifu: emitterIfu,
        client_ifu,
        client_name,
        vessel_name,
        arrival_date,
        service_description: service_description.trim(),
        amount_service: servNum,
        amount_tva: tva,
        debours_description: debours_description.trim(),
        amount_debours: debNum,
        amount_total: total,
        nim: sec.nim,
        code_mecef: sec.codeMECeFDGI,
        counters: sec.counters,
        date_time: sec.dateTime,
        qr_code: sec.qrCode,
        dgi_uid: dgiResult.uid
      }
    });
  } catch (err) {
    console.error('Erreur normalisation:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Backend Express e-MECeF connecte sur http://127.0.0.1:${PORT}`);
});
