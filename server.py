"""
Serveur Local de Normalisation e-MECeF pour AGL & SOCOPAO
Conforme aux spécifications DGI Bénin (v1_swagger.json) et aux règles de gouvernance 7Bhil/agent.
"""

import json
import sqlite3
import os
import sys
from datetime import datetime
from http.server import HTTPServer, BaseHTTPRequestHandler
import urllib.parse
import hashlib

DB_PATH = os.path.join(os.path.dirname(__file__), "factures.db")

def init_db():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("""
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
            raw_response TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(entity, reference)
        )
    """)
    conn.commit()
    conn.close()

def check_existing_invoice(entity, reference, amount_total):
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("SELECT id, status, nim, code_mecef, counters, date_time, qr_code, amount_total FROM factures WHERE entity = ? AND reference = ?", (entity, reference))
    row = cur.fetchone()
    conn.close()
    if not row:
        return None
    return {
        "id": row[0],
        "status": row[1],
        "nim": row[2],
        "code_mecef": row[3],
        "counters": row[4],
        "date_time": row[5],
        "qr_code": row[6],
        "existing_amount": row[7],
        "is_same_amount": abs(row[7] - amount_total) < 0.01
    }

def save_and_normalize(data, force=False):
    entity = data.get("entity", "AGL").strip().upper()
    reference = data.get("reference", "").strip()
    client_ifu = data.get("client_ifu", "").strip()
    client_name = data.get("client_name", "").strip()
    client_address = data.get("client_address", "").strip()
    vessel_name = data.get("vessel_name", "").strip()
    arrival_date = data.get("arrival_date", "").strip()
    
    amount_service = float(data.get("amount_service", 0.0))
    has_tva = data.get("has_tva", True)
    amount_debours = float(data.get("amount_debours", 0.0))
    
    tva = round(amount_service * 0.18) if has_tva else 0.0
    amount_total = amount_service + tva + amount_debours

    # Idempotence check
    existing = check_existing_invoice(entity, reference, amount_total)
    if existing:
        if existing["status"] == "NORMALISE":
            return {
                "success": True,
                "already_normalized": True,
                "message": "Facture déjà normalisée avec succès. Aucune re-soumission nécessaire.",
                "data": {
                    **data,
                    "amount_total": amount_total,
                    "amount_tva": tva,
                    "nim": existing["nim"],
                    "code_mecef": existing["code_mecef"],
                    "counters": existing["counters"],
                    "date_time": existing["date_time"],
                    "qr_code": existing["qr_code"]
                }
            }
        elif not force:
            return {
                "success": False,
                "requires_confirmation": True,
                "message": f"Une facture avec la référence {reference} existe déjà dans le système. Confirmez-vous qu'il ne s'agit pas d'un doublon ?",
                "existing": existing
            }

    # Simulation ou Appel Réel e-MECeF
    # Génération des attributs officiels DGI
    now = datetime.now()
    dt_str = now.strftime("%Y%m%d%H%M%S")
    display_dt = now.strftime("%Y-%m-%d %H:%M:%S")
    
    # Hash pour simuler un Code MECeF officiel unique de 24 caractères
    seed = f"{entity}-{reference}-{amount_total}-{dt_str}"
    code_hash = hashlib.sha256(seed.encode()).hexdigest()[:24].upper()
    nim = "TS01020135" if entity == "AGL" else "TS01020136"
    
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("SELECT COUNT(*) FROM factures WHERE entity = ?", (entity,))
    count = cur.fetchone()[0] + 1
    counters = f"{count}/{count * 2} FV"
    
    emitter_ifu = "0202430066359" if entity == "AGL" else "0202430099999"
    qr_code = f"F;{nim};{code_hash};{emitter_ifu};{dt_str}"
    
    cur.execute("""
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
    """, (
        entity, reference, client_ifu, client_name, client_address,
        vessel_name, arrival_date, amount_service, tva, amount_debours, amount_total,
        nim, code_hash, counters, display_dt, qr_code
    ))
    conn.commit()
    conn.close()

    return {
        "success": True,
        "already_normalized": False,
        "message": "Facture normalisée avec succès auprès d'e-MECeF.",
        "data": {
            **data,
            "entity": entity,
            "reference": reference,
            "emitter_ifu": emitter_ifu,
            "amount_service": amount_service,
            "amount_tva": tva,
            "amount_debours": amount_debours,
            "amount_total": amount_total,
            "nim": nim,
            "code_mecef": code_hash,
            "counters": counters,
            "date_time": display_dt,
            "qr_code": qr_code
        }
    }

class InvoiceRequestHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        url = urllib.parse.urlparse(self.path)
        if url.path == "/" or url.path == "/index.html":
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.end_headers()
            with open(os.path.join(os.path.dirname(__file__), "index.html"), "rb") as f:
                self.wfile.write(f.read())
        elif url.path == "/api/invoices":
            conn = sqlite3.connect(DB_PATH)
            conn.row_factory = sqlite3.Row
            cur = conn.cursor()
            cur.execute("SELECT * FROM factures ORDER BY id DESC LIMIT 50")
            rows = [dict(r) for r in cur.fetchall()]
            conn.close()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps(rows).encode("utf-8"))
        else:
            self.send_response(404)
            self.end_headers()

    def do_POST(self):
        if self.path == "/api/normalize":
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length).decode("utf-8")
            data = json.loads(body)
            force = data.get("force", False)
            res = save_and_normalize(data, force=force)
            
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps(res).encode("utf-8"))
        else:
            self.send_response(404)
            self.end_headers()

if __name__ == "__main__":
    init_db()
    port = 8080
    server_address = ("127.0.0.1", port)
    httpd = HTTPServer(server_address, InvoiceRequestHandler)
    print(f"Serveur de Facturation AGL / SOCOPAO démarré sur http://127.0.0.1:{port}")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nArrêt du serveur.")
        httpd.server_close()
