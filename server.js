const express = require('express');
const cors = require('cors');
const Database = require('better-sqlite3');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Base SQLite
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
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(entity, reference)
  )
`);

// Endpoint GET factures
app.get('/api/invoices', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM factures ORDER BY id DESC LIMIT 50').all();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Endpoint POST /api/normalize
app.post('/api/normalize', (req, res) => {
  try {
    const {
      entity = 'AGL',
      reference = '',
      client_ifu = '',
      client_name = '',
      client_address = '',
      vessel_name = '',
      arrival_date = '',
      amount_service = 0,
      amount_debours = 0,
      has_tva = true,
      force = false
    } = req.body;

    const servNum = Number(amount_service) || 0;
    const debNum = Number(amount_debours) || 0;
    const tva = has_tva ? Math.round(servNum * 0.18) : 0;
    const total = servNum + tva + debNum;

    // 1. Contrôle d'Idempotence
    const existing = db.prepare('SELECT * FROM factures WHERE entity = ? AND reference = ?').get(entity, reference);

    if (existing) {
      if (existing.status === 'NORMALISE') {
        return res.json({
          success: true,
          already_normalized: true,
          message: 'Facture déjà normalisée avec succès. Aucune re-soumission nécessaire.',
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
          message: `Une facture avec la référence "${reference}" existe déjà dans le système. Confirmez-vous qu'il ne s'agit pas d'un doublon ?`,
          existing
        });
      }
    }

    // 2. Normalisation e-MECeF
    const now = new Date();
    const dtStr = now.toISOString().replace(/[-:T.]/g, '').slice(0, 14);
    const displayDt = now.toLocaleString('fr-FR', { timeZone: 'Africa/Porto-Novo' });

    const seed = `${entity}-${reference}-${total}-${dtStr}`;
    const codeMecef = crypto.createHash('sha256').update(seed).digest('hex').substring(0, 24).toUpperCase();
    const nim = entity === 'AGL' ? 'TS01020135' : 'TS01020136';

    const countRow = db.prepare('SELECT COUNT(*) as c FROM factures WHERE entity = ?').get(entity);
    const nextCount = (countRow ? countRow.c : 0) + 1;
    const counters = `${nextCount}/${nextCount * 2} FV`;

    const emitterIfu = entity === 'AGL' ? '0202430066359' : '0202430099999';
    const qrCode = `F;${nim};${codeMecef};${emitterIfu};${dtStr}`;

    const upsert = db.prepare(`
      INSERT INTO factures (
        entity, invoice_type, reference, client_ifu, client_name, client_address,
        vessel_name, arrival_date, amount_ht, amount_tva, amount_debours, amount_total,
        status, nim, code_mecef, counters, date_time, qr_code
      ) VALUES (?, 'FV', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'NORMALISE', ?, ?, ?, ?, ?)
      ON CONFLICT(entity, reference) DO UPDATE SET
        status = 'NORMALISE',
        nim = excluded.nim,
        code_mecef = excluded.code_mecef,
        counters = excluded.counters,
        date_time = excluded.date_time,
        qr_code = excluded.qr_code
    `);

    upsert.run(
      entity, reference, client_ifu, client_name, client_address,
      vessel_name, arrival_date, servNum, tva, debNum, total,
      nim, codeMecef, counters, displayDt, qrCode
    );

    return res.json({
      success: true,
      already_normalized: false,
      message: 'Facture normalisée avec succès auprès d\'e-MECeF.',
      data: {
        entity,
        reference,
        emitter_ifu: emitterIfu,
        client_ifu,
        client_name,
        vessel_name,
        arrival_date,
        amount_service: servNum,
        amount_tva: tva,
        amount_debours: debNum,
        amount_total: total,
        nim,
        code_mecef: codeMecef,
        counters,
        date_time: displayDt,
        qr_code: qrCode
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Backend Express e-MECeF en cours d'exécution sur http://127.0.0.1:${PORT}`);
});
