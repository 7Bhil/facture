const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'factures.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS factures_v2 (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity TEXT NOT NULL,
      dossier_ref TEXT NOT NULL,
      invoice_type TEXT NOT NULL DEFAULT 'FV',
      original_mecef_code TEXT,
      client_ifu TEXT,
      client_name TEXT NOT NULL,
      client_address TEXT,
      client_contact TEXT,
      vessel_name TEXT,
      arrival_date TEXT,
      bl_number TEXT,
      custom_message TEXT,
      aib_type TEXT,
      payment_type TEXT NOT NULL DEFAULT 'VIREMENT',
      taa INTEGER NOT NULL DEFAULT 0,
      tab INTEGER NOT NULL DEFAULT 0,
      tac INTEGER NOT NULL DEFAULT 0,
      tad INTEGER NOT NULL DEFAULT 0,
      tae INTEGER NOT NULL DEFAULT 0,
      taf INTEGER NOT NULL DEFAULT 0,
      hab INTEGER NOT NULL DEFAULT 0,
      had INTEGER NOT NULL DEFAULT 0,
      vab INTEGER NOT NULL DEFAULT 0,
      vad INTEGER NOT NULL DEFAULT 0,
      aib_amount INTEGER NOT NULL DEFAULT 0,
      ts_amount INTEGER NOT NULL DEFAULT 0,
      total_ttc INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'NORMALISE',
      dgi_uid TEXT,
      nim TEXT,
      code_mecef TEXT,
      counters TEXT,
      date_time TEXT,
      qr_code TEXT,
      emitter_ifu TEXT,
      emitter_address TEXT,
      emitter_contact TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(entity, dossier_ref, invoice_type)
    );

    CREATE TABLE IF NOT EXISTS facture_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      facture_id INTEGER NOT NULL,
      line_number INTEGER NOT NULL,
      code TEXT,
      name TEXT NOT NULL,
      tax_group TEXT NOT NULL DEFAULT 'B',
      unit_price_ttc INTEGER NOT NULL,
      quantity REAL NOT NULL DEFAULT 1,
      tax_specific INTEGER NOT NULL DEFAULT 0,
      line_total_ttc INTEGER NOT NULL,
      FOREIGN KEY (facture_id) REFERENCES factures_v2(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ifu TEXT UNIQUE,
      name TEXT NOT NULL,
      address TEXT,
      contact TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS catalog_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      tax_group TEXT NOT NULL,
      default_price_ttc INTEGER NOT NULL DEFAULT 0,
      category TEXT NOT NULL
    );
  `);

  // Pré-remplissage du catalogue des rubriques maritimes AGL / SOCOPAO
  const countCatalog = db.prepare('SELECT COUNT(*) as c FROM catalog_items').get().c;
  if (countCatalog === 0) {
    const insertCat = db.prepare(`
      INSERT INTO catalog_items (code, name, tax_group, default_price_ttc, category)
      VALUES (?, ?, ?, ?, ?)
    `);
    const defaultCatalog = [
      ['SRV-MAN', 'MANUTENTION PORTUAIRE ET ACCONAGE', 'B', 0, 'Prestation Taxable (18%)'],
      ['SRV-MAG', 'MAGASINAGE ET STOCKAGE TERMINAL', 'B', 0, 'Prestation Taxable (18%)'],
      ['SRV-SUR', 'SURESTARIES ET DETENTION CONTENEUR', 'B', 0, 'Prestation Taxable (18%)'],
      ['SRV-BAD', 'FRAIS DE DOSSIER ET BON A DELIVRER (BAD)', 'B', 0, 'Prestation Taxable (18%)'],
      ['SRV-HAD', 'HONORAIRES D AGREEE EN DOUANE (HAD)', 'B', 0, 'Prestation Taxable (18%)'],
      ['SRV-TRN', 'TRANSPORT ET LIVRAISON CONTENEUR', 'B', 0, 'Prestation Taxable (18%)'],
      ['DEB-DOU', 'DEBOURS DROITS ET TAXES DE DOUANE', 'A', 0, 'Débours sans TVA (0%)'],
      ['DEB-PAC', 'DEBOURS REDEVANCES PORT AUTONOME DE COTONOU (PAC)', 'A', 0, 'Débours sans TVA (0%)'],
      ['DEB-ESC', 'DEBOURS FRAIS D ESCALE ET REMORQUAGE', 'A', 0, 'Débours sans TVA (0%)'],
      ['DEB-SCAN', 'DEBOURS FRAIS DE SCANNER ET VISITE DOUANIERE', 'A', 0, 'Débours sans TVA (0%)'],
      ['EXP-MAN', 'PRESTATIONS D EXPORTATION MARITIME', 'C', 0, 'Exportation (0%)']
    ];
    const tx = db.transaction(() => {
      for (const item of defaultCatalog) {
        insertCat.run(...item);
      }
    });
    tx();
  }

  // Pré-remplissage d'exemples clients dans l'annuaire local
  const countClients = db.prepare('SELECT COUNT(*) as c FROM clients').get().c;
  if (countClients === 0) {
    db.prepare(`
      INSERT OR IGNORE INTO clients (ifu, name, address, contact)
      VALUES (?, ?, ?, ?)
    `).run('0202430066359', 'AGENCE MARITIME COTONOU TEST', 'Port de Cotonou, Zone Portuaire', '0144242964');
  }
}

initDb();

module.exports = db;
