import { useState, useEffect, useMemo, useRef } from 'react';
import {
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Plus,
  Trash2,
  Download,
  Pin,
  FileSpreadsheet,
  History,
  Zap,
  RefreshCw,
  Eye,
  X
} from 'lucide-react';
import InvoiceSheetA4 from './InvoiceSheetA4';

const API_BASE = 'http://127.0.0.1:3001';

const RUBRIQUES_RAPIDES = [
  'MANUTENTION PORTUAIRE ET ACCONAGE',
  'MAGASINAGE ET STOCKAGE TERMINAL',
  'SURESTARIES ET DETENTION CONTENEUR',
  'FRAIS DE DOSSIER ET BON A DELIVRER (BAD)',
  'HONORAIRES D AGREEE EN DOUANE (HAD)',
  'TRANSPORT ET LIVRAISON CONTENEUR',
  'DEBOURS DROITS ET TAXES DE DOUANE',
  'DEBOURS REDEVANCES PORT AUTONOME DE COTONOU (PAC)',
  'DEBOURS FRAIS D ESCALE ET REMORQUAGE',
  'DEBOURS FRAIS DE SCANNER ET VISITE DOUANIERE'
];

function createRow(name = '', taxGroup = 'B', price = '') {
  return {
    id: Math.random().toString(36).substring(2, 9),
    name,
    tax_group: taxGroup, // 'B' (18%) ou 'A' (0% Débours)
    unit_price_ttc: price,
    quantity: 1
  };
}

function triggerPdfDownload(invoiceId) {
  const link = document.createElement('a');
  link.href = `${API_BASE}/api/invoices/${invoiceId}/pdf`;
  link.setAttribute('download', '');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export default function App() {
  // Navigation : 'speed' (Poste de saisie rapide) | 'batch' (Import lot en masse) | 'journal' (Historique)
  const [mode, setMode] = useState('speed');

  // Parametres epingles pour enchainer les factures d'un meme navire sans ressaisie
  const [entity, setEntity] = useState('AGL');
  const [invoiceType, setInvoiceType] = useState('FV');
  const [pinVessel, setPinVessel] = useState(true);
  const [vesselName, setVesselName] = useState('');
  const [arrivalDate, setArrivalDate] = useState('');
  const [paymentType, setPaymentType] = useState('VIREMENT');
  const [autoDownloadPdf, setAutoDownloadPdf] = useState(true);
  const [autoClearAfterSuccess, setAutoClearAfterSuccess] = useState(true);

  // Champs propres a chaque facture
  const [dossierRef, setDossierRef] = useState('');
  const [originalMecefCode, setOriginalMecefCode] = useState('');
  const [clientIfu, setClientIfu] = useState('');
  const [clientName, setClientName] = useState('');
  const [clientAddress, setClientAddress] = useState('');

  // Lignes de la facture (ultra-compactes : Nom | Montant | [18% | Débours 0%])
  const [rows, setRows] = useState([
    createRow('MANUTENTION PORTUAIRE ET ACCONAGE', 'B', ''),
    createRow('DEBOURS DROITS ET TAXES DE DOUANE', 'A', '')
  ]);

  // Etats de retour immediat (Impossible a rater)
  const [submitting, setSubmitting] = useState(false);
  const [statusFeedback, setStatusFeedback] = useState(null); // { type: 'success' | 'error', title, detail, invoice }
  const [duplicateModal, setDuplicateModal] = useState(null);
  const [previewInvoice, setPreviewInvoice] = useState(null);

  // Historique & Statut DGI
  const [recentInvoices, setRecentInvoices] = useState([]);
  const [emcfStatus, setEmcfStatus] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Mode Batch (Traitement de lot par copier-coller Excel)
  const [batchText, setBatchText] = useState('');
  const [batchQueue, setBatchQueue] = useState([]);
  const [batchRunning, setBatchRunning] = useState(false);

  const dossierInputRef = useRef(null);

  useEffect(() => {
    fetchInvoices();
    fetchStatus(entity);
  }, [entity]);

  const fetchStatus = async (ent) => {
    try {
      const res = await fetch(`${API_BASE}/api/emcf-status/${ent}`);
      const data = await res.json();
      if (data.success) setEmcfStatus(data);
    } catch {
      // ignore
    }
  };

  const fetchInvoices = async (q = searchQuery) => {
    try {
      const params = new URLSearchParams();
      if (q) params.set('search', q);
      const res = await fetch(`${API_BASE}/api/invoices?${params.toString()}`);
      const data = await res.json();
      if (data.success) setRecentInvoices(data.invoices || []);
    } catch {
      // ignore
    }
  };

  // Auto-completion client dès 13 chiffres IFU
  const handleIfuChange = async (val) => {
    const clean = val.replace(/\D/g, '').slice(0, 13);
    setClientIfu(clean);
    if (clean.length === 13) {
      try {
        const res = await fetch(`${API_BASE}/api/clients/lookup?ifu=${clean}`);
        const data = await res.json();
        if (data.success && data.client) {
          setClientName(data.client.name || '');
          setClientAddress(data.client.address || '');
        }
      } catch {
        // ignore
      }
    }
  };

  const updateRow = (id, field, value) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        const updated = { ...r, [field]: value };
        // Detection automatique du groupe Débours si le libelle contient "DEBOURS"
        if (field === 'name' && value.toUpperCase().includes('DEBOURS')) {
          updated.tax_group = 'A';
        }
        return updated;
      })
    );
  };

  const addRow = (defaultGroup = 'B') => {
    setRows((prev) => [...prev, createRow('', defaultGroup, '')]);
  };

  const removeRow = (id) => {
    if (rows.length <= 1) return;
    setRows((prev) => prev.filter((r) => r.id !== id));
  };

  // Calcul temps reel
  const totals = useMemo(() => {
    let taxableTtc = 0;
    let debours = 0;
    for (const r of rows) {
      const amt = Math.round(Number(r.unit_price_ttc) || 0);
      if (amt > 0) {
        if (r.tax_group === 'B') taxableTtc += amt;
        else debours += amt;
      }
    }
    const ht = Math.round(taxableTtc / 1.18);
    const tva = taxableTtc - ht;
    return {
      ht,
      tva,
      taxableTtc,
      debours,
      totalTtc: taxableTtc + debours
    };
  }, [rows]);

  // Validation & Envoi ultra-rapide
  const handleSubmit = async (force = false) => {
    setDuplicateModal(null);

    if (!dossierRef.trim()) {
      setStatusFeedback({
        type: 'error',
        title: 'N° DOSSIER MANQUANT',
        detail: 'Saisissez le numero de facture / dossier en haut a gauche.'
      });
      dossierInputRef.current?.focus();
      return;
    }

    if (!clientName.trim()) {
      setStatusFeedback({
        type: 'error',
        title: 'NOM DU CLIENT MANQUANT',
        detail: 'Renseignez le nom du client (ou son IFU a 13 chiffres).'
      });
      return;
    }

    const validItems = rows
      .map((r) => ({
        name: r.name.trim(),
        tax_group: r.tax_group,
        unit_price_ttc: Math.round(Number(r.unit_price_ttc) || 0),
        quantity: 1
      }))
      .filter((r) => r.name !== '' && r.unit_price_ttc > 0);

    if (validItems.length === 0) {
      setStatusFeedback({
        type: 'error',
        title: 'AUCUN MONTANT SAISI',
        detail: 'Saisissez au moins une ligne avec un nom de rubrique et un montant superieur a 0.'
      });
      return;
    }

    setSubmitting(true);
    setStatusFeedback(null);

    try {
      const res = await fetch(`${API_BASE}/api/normalize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entity,
          dossier_ref: dossierRef.trim(),
          invoice_type: invoiceType,
          original_mecef_code: originalMecefCode.trim(),
          client: {
            ifu: clientIfu.trim(),
            name: clientName.trim(),
            address: clientAddress.trim() || 'Cotonou, Benin'
          },
          vessel_name: vesselName.trim(),
          arrival_date: arrivalDate,
          payment_type: paymentType,
          items: validItems,
          force
        })
      });

      const data = await res.json();

      if (data.requires_confirmation) {
        setDuplicateModal(data.message);
        return;
      }

      if (!data.success) {
        setStatusFeedback({
          type: 'error',
          title: 'REJET DGI / ERREUR DE VALIDATION',
          detail: data.message
        });
        return;
      }

      const certified = data.data;

      // 1. Feedback visuel geant immanquable
      setStatusFeedback({
        type: 'success',
        title: data.already_normalized
          ? `DEJA NORMALISEE — CODE MECeF : ${certified.code_mecef}`
          : `FACTURE ACCEPTEE PAR LA DGI — CODE MECeF : ${certified.code_mecef}`,
        detail: `Dossier ${certified.dossier_ref} | Client : ${certified.client_name} | Total : ${Number(certified.total_ttc).toLocaleString('fr-FR')} FCFA`,
        invoice: certified
      });

      // 2. Telechargement automatique du PDF officiel sans boite d'impression
      if (autoDownloadPdf && certified.id) {
        triggerPdfDownload(certified.id);
      }

      // 3. Rafraichissement de la liste a droite
      fetchInvoices();

      // 4. Preparation immediate pour la facture suivante (Mode Rafale)
      if (autoClearAfterSuccess && !data.already_normalized) {
        setDossierRef('');
        setClientIfu('');
        setClientName('');
        setClientAddress('');
        if (!pinVessel) {
          setVesselName('');
          setArrivalDate('');
        }
        setRows([
          createRow('MANUTENTION PORTUAIRE ET ACCONAGE', 'B', ''),
          createRow('DEBOURS DROITS ET TAXES DE DOUANE', 'A', '')
        ]);
        setTimeout(() => {
          dossierInputRef.current?.focus();
        }, 100);
      }
    } catch {
      setStatusFeedback({
        type: 'error',
        title: 'SERVEUR LOCAL INJOIGNABLE',
        detail: 'Verifiez que le serveur Express tourne sur le port 3001.'
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Raccourci clavier global Ctrl + Entree pour valider instantanement
  const handleKeyDown = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSubmit(false);
    }
  };

  // Analyse d'un lot de factures collees depuis Excel
  // Format ligne : Dossier [TAB] NomClient [TAB] IFU [TAB] Navire [TAB] Date [TAB] MontantTaxable18 [TAB] MontantDebours0
  const handleParseBatch = () => {
    if (!batchText.trim()) return;
    const lines = batchText.trim().split(/\r?\n/);
    const parsed = [];

    for (let i = 0; i < lines.length; i++) {
      const cols = lines[i].split(/\t|;/).map((c) => c.trim());
      if (cols.length < 2) continue;
      // Ignore header row if present
      if (cols[0].toLowerCase().includes('dossier') || cols[0].toLowerCase().includes('facture')) continue;

      const ref = cols[0];
      const cName = cols[1] || 'CLIENT COMPTANT';
      const cIfu = (cols[2] || '').replace(/\D/g, '');
      const nav = cols[3] || vesselName;
      const arrDate = cols[4] || arrivalDate;
      const mTaxable = Math.round(Number((cols[5] || '0').replace(/\s/g, '').replace(',', '.')) || 0);
      const mDebours = Math.round(Number((cols[6] || '0').replace(/\s/g, '').replace(',', '.')) || 0);

      if (ref && (mTaxable > 0 || mDebours > 0)) {
        const batchItems = [];
        if (mTaxable > 0) {
          batchItems.push({
            name: 'PRESTATIONS MARITIMES ET TRANSIT',
            tax_group: 'B',
            unit_price_ttc: mTaxable,
            quantity: 1
          });
        }
        if (mDebours > 0) {
          batchItems.push({
            name: 'DEBOURS DOUANE ET FRAIS PORTUAIRES',
            tax_group: 'A',
            unit_price_ttc: mDebours,
            quantity: 1
          });
        }
        parsed.push({
          id: i + 1,
          dossier_ref: ref,
          client_name: cName,
          client_ifu: cIfu.length === 13 ? cIfu : '',
          vessel_name: nav,
          arrival_date: arrDate,
          taxable: mTaxable,
          debours: mDebours,
          total: mTaxable + mDebours,
          items: batchItems,
          status: 'EN_ATTENTE',
          code_mecef: null,
          invoice_id: null,
          error: null
        });
      }
    }
    setBatchQueue(parsed);
  };

  const handleRunBatch = async () => {
    if (batchQueue.length === 0 || batchRunning) return;
    setBatchRunning(true);

    for (let i = 0; i < batchQueue.length; i++) {
      const row = batchQueue[i];
      if (row.status === 'NORMALISE') continue;

      setBatchQueue((prev) =>
        prev.map((item, idx) => (idx === i ? { ...item, status: 'EN_COURS' } : item))
      );

      try {
        const res = await fetch(`${API_BASE}/api/normalize`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            entity,
            dossier_ref: row.dossier_ref,
            invoice_type: 'FV',
            client: {
              ifu: row.client_ifu,
              name: row.client_name,
              address: 'Cotonou, Benin'
            },
            vessel_name: row.vessel_name,
            arrival_date: row.arrival_date,
            payment_type: paymentType,
            items: row.items,
            force: true
          })
        });
        const data = await res.json();
        if (data.success && data.data) {
          setBatchQueue((prev) =>
            prev.map((item, idx) =>
              idx === i
                ? {
                    ...item,
                    status: 'NORMALISE',
                    code_mecef: data.data.code_mecef,
                    invoice_id: data.data.id
                  }
                : item
            )
          );
          if (autoDownloadPdf && data.data.id) {
            triggerPdfDownload(data.data.id);
          }
        } else {
          setBatchQueue((prev) =>
            prev.map((item, idx) =>
              idx === i ? { ...item, status: 'ERREUR', error: data.message } : item
            )
          );
        }
      } catch (err) {
        setBatchQueue((prev) =>
          prev.map((item, idx) =>
            idx === i ? { ...item, status: 'ERREUR', error: err.message } : item
          )
        );
      }
    }

    setBatchRunning(false);
    fetchInvoices();
  };

  return (
    <div
      onKeyDown={handleKeyDown}
      className="flex flex-col h-screen w-screen overflow-hidden bg-neutral-100 text-neutral-900 font-sans select-none"
    >
      {/* Datalist pour autocompletion instantanee des rubriques */}
      <datalist id="rubriques-list">
        {RUBRIQUES_RAPIDES.map((r) => (
          <option key={r} value={r} />
        ))}
      </datalist>

      {/* BARRE HAUTE COMPACTE */}
      <header className="no-print h-12 bg-neutral-900 text-white px-4 flex items-center justify-between flex-shrink-0 border-b border-neutral-800">
        <div className="flex items-center gap-4">
          <div className="font-bold text-xs tracking-wider uppercase flex items-center gap-2">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
            POSTE DE NORMALISATION HAUTE VITESSE
          </div>

          {/* Bascule Entite AGL / SOCOPAO */}
          <div className="flex bg-neutral-800 p-0.5 rounded border border-neutral-700">
            {['AGL', 'SOCOPAO'].map((ent) => (
              <button
                key={ent}
                type="button"
                onClick={() => setEntity(ent)}
                className={`px-3 py-1 text-xs font-bold rounded transition ${
                  entity === ent ? 'bg-white text-neutral-900' : 'text-neutral-400 hover:text-white'
                }`}
              >
                {ent}
              </button>
            ))}
          </div>

          {/* Modes de travail */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setMode('speed')}
              className={`px-3 py-1 rounded text-xs font-semibold flex items-center gap-1.5 ${
                mode === 'speed' ? 'bg-neutral-700 text-white' : 'text-neutral-400 hover:text-white'
              }`}
            >
              <Zap className="w-3.5 h-3.5" /> Saisie Rapide (1 par 1)
            </button>
            <button
              type="button"
              onClick={() => setMode('batch')}
              className={`px-3 py-1 rounded text-xs font-semibold flex items-center gap-1.5 ${
                mode === 'batch' ? 'bg-neutral-700 text-white' : 'text-neutral-400 hover:text-white'
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" /> Mode Lot Excel (En Masse)
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('journal');
                fetchInvoices();
              }}
              className={`px-3 py-1 rounded text-xs font-semibold flex items-center gap-1.5 ${
                mode === 'journal' ? 'bg-neutral-700 text-white' : 'text-neutral-400 hover:text-white'
              }`}
            >
              <History className="w-3.5 h-3.5" /> Historique ({recentInvoices.length})
            </button>
          </div>
        </div>

        {/* Options d'automatisation & Statut DGI */}
        <div className="flex items-center gap-4 text-xs">
          <label className="flex items-center gap-1.5 cursor-pointer text-neutral-300 hover:text-white">
            <input
              type="checkbox"
              checked={autoDownloadPdf}
              onChange={(e) => setAutoDownloadPdf(e.target.checked)}
              className="rounded accent-emerald-500"
            />
            <span>Telecharger PDF auto</span>
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer text-neutral-300 hover:text-white">
            <input
              type="checkbox"
              checked={autoClearAfterSuccess}
              onChange={(e) => setAutoClearAfterSuccess(e.target.checked)}
              className="rounded accent-emerald-500"
            />
            <span>Vider apres validation</span>
          </label>
          {emcfStatus && (
            <div className="bg-neutral-800 px-2.5 py-1 rounded border border-neutral-700 font-mono text-[11px] text-neutral-300">
              NIM: {emcfStatus.nim}
            </div>
          )}
        </div>
      </header>

      {/* MODE 1 : POSTE DE SAISIE RAPIDE ZERO-SCROLL */}
      {mode === 'speed' && (
        <div className="flex-1 grid grid-cols-12 overflow-hidden">
          
          {/* ZONE CENTRALE DE SAISIE (8 colonnes - Zero Scroll) */}
          <div className="col-span-8 bg-white border-r border-neutral-300 p-4 flex flex-col justify-between overflow-hidden">
            
            <div className="space-y-3 overflow-y-auto pr-1">
              
              {/* BANDEAU DE STATUT GEANT (IMPOSSIBLE A RATER) */}
              {statusFeedback && (
                <div
                  className={`p-3 rounded border-2 flex items-center justify-between ${
                    statusFeedback.type === 'success'
                      ? 'bg-emerald-950 text-white border-emerald-500'
                      : 'bg-red-950 text-white border-red-500'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {statusFeedback.type === 'success' ? (
                      <CheckCircle2 className="w-6 h-6 text-emerald-400 flex-shrink-0" />
                    ) : (
                      <AlertCircle className="w-6 h-6 text-red-400 flex-shrink-0" />
                    )}
                    <div>
                      <div className="font-bold text-sm tracking-wide uppercase font-mono">
                        {statusFeedback.title}
                      </div>
                      <div className="text-xs text-neutral-300 mt-0.5">
                        {statusFeedback.detail}
                      </div>
                    </div>
                  </div>

                  {statusFeedback.invoice && (
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => triggerPdfDownload(statusFeedback.invoice.id)}
                        className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-bold text-xs rounded flex items-center gap-1.5"
                      >
                        <Download className="w-3.5 h-3.5" /> Re-telecharger PDF
                      </button>
                      <button
                        type="button"
                        onClick={() => setPreviewInvoice(statusFeedback.invoice)}
                        className="px-2.5 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-white text-xs rounded flex items-center gap-1"
                      >
                        <Eye className="w-3.5 h-3.5" /> Voir A4
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* LIGNE 1 : Dossier + Type + Navire (Epinglable) + Date (Epinglable) */}
              <div className="grid grid-cols-12 gap-2.5 bg-neutral-100 p-3 rounded border border-neutral-200 items-end">
                <div className="col-span-3">
                  <label className="text-[11px] font-bold text-neutral-700 block mb-1 uppercase">
                    1. N° Facture / Dossier *
                  </label>
                  <input
                    ref={dossierInputRef}
                    type="text"
                    placeholder="Ex: 848647"
                    value={dossierRef}
                    onChange={(e) => setDossierRef(e.target.value)}
                    autoFocus
                    className="w-full border-2 border-neutral-900 rounded px-2.5 py-1.5 text-sm font-bold bg-white outline-none"
                  />
                </div>

                <div className="col-span-3">
                  <label className="text-[11px] font-bold text-neutral-700 block mb-1 uppercase">
                    Type de Facture
                  </label>
                  <select
                    value={invoiceType}
                    onChange={(e) => setInvoiceType(e.target.value)}
                    className="w-full border border-neutral-300 rounded px-2 py-1.5 text-xs font-bold bg-white outline-none focus:border-neutral-900"
                  >
                    <option value="FV">FV - Facture de Vente</option>
                    <option value="FA">FA - Facture d'Avoir</option>
                    <option value="EV">EV - Vente Export</option>
                    <option value="EA">EA - Avoir Export</option>
                  </select>
                </div>

                <div className="col-span-3">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-bold text-neutral-700 uppercase">
                      Nom du Navire
                    </label>
                    <button
                      type="button"
                      onClick={() => setPinVessel(!pinVessel)}
                      className={`text-[10px] flex items-center gap-0.5 px-1.5 rounded ${
                        pinVessel ? 'bg-neutral-900 text-white' : 'text-neutral-500'
                      }`}
                      title="Garder le meme navire pour les factures suivantes"
                    >
                      <Pin className="w-2.5 h-2.5" /> {pinVessel ? 'Epingle' : 'Libre'}
                    </button>
                  </div>
                  <input
                    type="text"
                    placeholder="Ex: MSC LAURA"
                    value={vesselName}
                    onChange={(e) => setVesselName(e.target.value)}
                    className="w-full border border-neutral-300 rounded px-2.5 py-1.5 text-xs font-semibold bg-white outline-none focus:border-neutral-900"
                  />
                </div>

                <div className="col-span-3">
                  <label className="text-[11px] font-bold text-neutral-700 block mb-1 uppercase">
                    Date d'Arrivee
                  </label>
                  <input
                    type="date"
                    value={arrivalDate}
                    onChange={(e) => setArrivalDate(e.target.value)}
                    className="w-full border border-neutral-300 rounded px-2.5 py-1.5 text-xs font-semibold bg-white outline-none focus:border-neutral-900"
                  />
                </div>

                {(invoiceType === 'FA' || invoiceType === 'EA') && (
                  <div className="col-span-12 pt-2 border-t border-neutral-300 flex items-center gap-3">
                    <label className="text-xs font-bold text-red-800 whitespace-nowrap">
                      Code MECeF Facture Originale (24 car.) * :
                    </label>
                    <input
                      type="text"
                      placeholder="Collez le Code MECeF de la facture a annuler/corriger"
                      value={originalMecefCode}
                      onChange={(e) => setOriginalMecefCode(e.target.value)}
                      className="flex-1 border border-neutral-400 rounded px-2.5 py-1 text-xs font-mono uppercase bg-white"
                    />
                  </div>
                )}
              </div>

              {/* LIGNE 2 : Client (IFU 13 chiffres -> Nom Auto | Adresse) */}
              <div className="grid grid-cols-12 gap-2.5 bg-neutral-100 p-3 rounded border border-neutral-200">
                <div className="col-span-3">
                  <label className="text-[11px] font-bold text-neutral-700 block mb-1 uppercase">
                    2. IFU Client (13 ch.)
                  </label>
                  <input
                    type="text"
                    maxLength={13}
                    placeholder="Vide si etranger"
                    value={clientIfu}
                    onChange={(e) => handleIfuChange(e.target.value)}
                    className="w-full border border-neutral-300 rounded px-2.5 py-1.5 text-xs font-mono bg-white outline-none focus:border-neutral-900"
                  />
                </div>
                <div className="col-span-5">
                  <label className="text-[11px] font-bold text-neutral-700 block mb-1 uppercase">
                    Nom / Raison Sociale du Client *
                  </label>
                  <input
                    type="text"
                    placeholder="Saisissez le nom du client"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    className="w-full border border-neutral-300 rounded px-2.5 py-1.5 text-xs font-bold bg-white outline-none focus:border-neutral-900"
                  />
                </div>
                <div className="col-span-4">
                  <label className="text-[11px] font-bold text-neutral-700 block mb-1 uppercase">
                    Adresse Client
                  </label>
                  <input
                    type="text"
                    placeholder="Cotonou, Benin"
                    value={clientAddress}
                    onChange={(e) => setClientAddress(e.target.value)}
                    className="w-full border border-neutral-300 rounded px-2.5 py-1.5 text-xs bg-white outline-none focus:border-neutral-900"
                  />
                </div>
              </div>

              {/* LIGNE 3 : GRILLE ULTRA-RAPIDE DES RUBRIQUES (Style Excel RECAP) */}
              <div className="border border-neutral-300 rounded overflow-hidden">
                <div className="bg-neutral-900 text-white px-3 py-2 flex items-center justify-between text-xs">
                  <span className="font-bold uppercase tracking-wider">
                    3. Lignes de la Facture (Prestations TTC 18% & Debours 0%)
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => addRow('B')}
                      className="px-2.5 py-1 bg-neutral-700 hover:bg-neutral-600 rounded text-[11px] font-bold flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" /> + Ligne Taxable 18%
                    </button>
                    <button
                      type="button"
                      onClick={() => addRow('A')}
                      className="px-2.5 py-1 bg-neutral-700 hover:bg-neutral-600 rounded text-[11px] font-bold flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" /> + Ligne Debours 0%
                    </button>
                  </div>
                </div>

                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="bg-neutral-100 border-b border-neutral-300 text-neutral-600 text-[11px] uppercase">
                      <th className="py-1.5 px-2 text-center w-8">#</th>
                      <th className="py-1.5 px-2 text-left">Rubrique / Libelle de la ligne</th>
                      <th className="py-1.5 px-2 text-center w-44">Regime Fiscal</th>
                      <th className="py-1.5 px-2 text-right w-44">Montant TTC (FCFA)</th>
                      <th className="py-1.5 px-2 text-center w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, idx) => (
                      <tr key={r.id} className="border-b border-neutral-200 hover:bg-neutral-50">
                        <td className="py-1.5 px-2 text-center font-bold text-neutral-400">
                          {idx + 1}
                        </td>
                        <td className="py-1.5 px-2">
                          <input
                            type="text"
                            list="rubriques-list"
                            placeholder="Tapez ou choisissez une rubrique..."
                            value={r.name}
                            onChange={(e) => updateRow(r.id, 'name', e.target.value)}
                            className="w-full border border-neutral-300 rounded px-2.5 py-1.5 font-semibold outline-none focus:border-neutral-900"
                          />
                        </td>
                        <td className="py-1.5 px-2">
                          <div className="grid grid-cols-2 bg-neutral-200 p-0.5 rounded">
                            <button
                              type="button"
                              onClick={() => updateRow(r.id, 'tax_group', 'B')}
                              className={`py-1 rounded text-[11px] font-bold transition ${
                                r.tax_group === 'B'
                                  ? 'bg-neutral-900 text-white shadow-sm'
                                  : 'text-neutral-600 hover:text-neutral-900'
                              }`}
                            >
                              TTC 18%
                            </button>
                            <button
                              type="button"
                              onClick={() => updateRow(r.id, 'tax_group', 'A')}
                              className={`py-1 rounded text-[11px] font-bold transition ${
                                r.tax_group === 'A'
                                  ? 'bg-neutral-900 text-white shadow-sm'
                                  : 'text-neutral-600 hover:text-neutral-900'
                              }`}
                            >
                              Debours 0%
                            </button>
                          </div>
                        </td>
                        <td className="py-1.5 px-2">
                          <input
                            type="number"
                            min="0"
                            placeholder="0"
                            value={r.unit_price_ttc}
                            onChange={(e) => updateRow(r.id, 'unit_price_ttc', e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && !e.ctrlKey) {
                                e.preventDefault();
                                handleSubmit(false);
                              }
                            }}
                            className="w-full border border-neutral-300 rounded px-2.5 py-1.5 text-right font-mono font-bold text-sm outline-none focus:border-neutral-900"
                          />
                        </td>
                        <td className="py-1.5 px-2 text-center">
                          <button
                            type="button"
                            onClick={() => removeRow(r.id)}
                            disabled={rows.length <= 1}
                            className="text-neutral-400 hover:text-red-600 disabled:opacity-20"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* BARRE DE PIED FIXE : TOTAUX EN DIRECT + BOUTON GEANT DE VALIDATION */}
            <div className="pt-3 border-t border-neutral-300 flex items-center justify-between gap-4 bg-white flex-shrink-0">
              <div className="flex items-center gap-5 text-xs">
                <div>
                  <span className="text-neutral-500 block text-[10px] uppercase font-bold">Prestations HT</span>
                  <span className="font-mono font-bold text-sm">{totals.ht.toLocaleString('fr-FR')} F</span>
                </div>
                <div>
                  <span className="text-neutral-500 block text-[10px] uppercase font-bold">TVA (18%)</span>
                  <span className="font-mono font-bold text-sm">{totals.tva.toLocaleString('fr-FR')} F</span>
                </div>
                <div>
                  <span className="text-neutral-500 block text-[10px] uppercase font-bold">Debours (0%)</span>
                  <span className="font-mono font-bold text-sm">{totals.debours.toLocaleString('fr-FR')} F</span>
                </div>
                <div className="pl-4 border-l border-neutral-300">
                  <span className="text-neutral-500 block text-[10px] uppercase font-bold">NET A PAYER TTC</span>
                  <span className="font-mono font-extrabold text-lg text-neutral-900">
                    {totals.totalTtc.toLocaleString('fr-FR')} FCFA
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleSubmit(false)}
                disabled={submitting}
                className="px-8 py-3.5 bg-neutral-900 hover:bg-neutral-800 disabled:bg-neutral-400 text-white font-bold text-sm rounded shadow-md uppercase tracking-wider flex items-center gap-2 transition"
              >
                {submitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" /> NORMALISATION DGI EN COURS...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" /> VALIDER & TELECHARGER PDF (ENTREE)
                  </>
                )}
              </button>
            </div>
          </div>

          {/* COLONNE DROITE (4 colonnes) : FIL D'ACTIVITE EN DIRECT & TELECHARGEMENT 1-CLIC */}
          <div className="col-span-4 bg-neutral-50 flex flex-col h-full overflow-hidden">
            <div className="p-3 bg-neutral-200 border-b border-neutral-300 flex items-center justify-between">
              <span className="font-bold text-xs uppercase tracking-wider text-neutral-800">
                Factures Validees Recemment ({recentInvoices.length})
              </span>
              <input
                type="text"
                placeholder="Filtrer dossier, client..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  fetchInvoices(e.target.value);
                }}
                className="border border-neutral-300 rounded px-2 py-1 text-xs bg-white w-44 outline-none"
              />
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-neutral-200 p-2 space-y-1.5">
              {recentInvoices.map((inv) => (
                <div
                  key={inv.id}
                  className="bg-white border border-neutral-200 rounded p-2.5 hover:border-neutral-400 transition flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="px-1.5 py-0.5 bg-neutral-900 text-white font-bold text-[10px] rounded">
                        {inv.entity}
                      </span>
                      <span className="font-bold text-xs truncate">
                        Dossier {inv.dossier_ref}
                      </span>
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 bg-emerald-100 text-emerald-900 rounded">
                        ACCEPTEE
                      </span>
                    </div>
                    <div className="text-xs text-neutral-700 font-medium truncate mt-0.5">
                      {inv.client_name}
                    </div>
                    <div className="text-[10px] font-mono text-neutral-500 mt-0.5">
                      {inv.code_mecef} | { inv.date_time}
                    </div>
                  </div>

                  <div className="text-right flex-shrink-0 space-y-1">
                    <div className="font-mono font-bold text-xs text-neutral-900">
                      {Number(inv.total_ttc).toLocaleString('fr-FR')} F
                    </div>
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => setPreviewInvoice(inv)}
                        className="px-2 py-1 border border-neutral-300 hover:bg-neutral-100 rounded text-[10px] font-bold"
                        title="Apercu A4"
                      >
                        Voir
                      </button>
                      <button
                        type="button"
                        onClick={() => triggerPdfDownload(inv.id)}
                        className="px-2 py-1 bg-neutral-900 hover:bg-neutral-800 text-white rounded text-[10px] font-bold flex items-center gap-1"
                        title="Telecharger directement le fichier PDF"
                      >
                        <Download className="w-3 h-3" /> PDF
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MODE 2 : TRAITEMENT DE LOT EN MASSE (COPIER-COLLER EXCEL) */}
      {mode === 'batch' && (
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-6xl mx-auto bg-white border border-neutral-300 rounded shadow-sm p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
              <div>
                <h2 className="font-bold text-sm uppercase tracking-wider">
                  Normalisation de Masse par Lot Excel ({entity})
                </h2>
                <p className="text-xs text-neutral-500 mt-0.5">
                  Collez directement un tableau de plusieurs factures depuis Excel pour les normaliser toutes a la chaine et telecharger leurs PDF automatiquement.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-xs font-bold text-neutral-700">
                Format des colonnes Excel a coller : N° Dossier [TAB] Nom Client [TAB] IFU (optionnel) [TAB] Navire [TAB] Date (AAAA-MM-JJ) [TAB] Montant TTC 18% [TAB] Montant Debours 0%
              </div>
              <textarea
                rows={5}
                placeholder={"849001\tSTE IMPORT BENIN\t0202430066359\tMSC LAURA\t2026-10-27\t118000\t50000\n849002\tTRANSIT EXPRESS\t\tMSC LAURA\t2026-10-27\t236000\t120000"}
                value={batchText}
                onChange={(e) => setBatchText(e.target.value)}
                className="w-full border border-neutral-300 rounded p-3 font-mono text-xs outline-none focus:border-neutral-900"
              />
              <div className="flex justify-between items-center">
                <button
                  type="button"
                  onClick={handleParseBatch}
                  className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-bold rounded"
                >
                  1. Analyser et Charger la File d'Attente
                </button>

                {batchQueue.length > 0 && (
                  <button
                    type="button"
                    onClick={handleRunBatch}
                    disabled={batchRunning}
                    className="px-6 py-2.5 bg-neutral-900 hover:bg-neutral-800 disabled:bg-neutral-400 text-white text-xs font-bold rounded uppercase tracking-wider"
                  >
                    {batchRunning
                      ? 'Normalisation du lot en cours...'
                      : `2. Lancer la Normalisation des ${batchQueue.length} Factures`}
                  </button>
                )}
              </div>
            </div>

            {batchQueue.length > 0 && (
              <table className="w-full border-collapse text-xs border border-neutral-300 mt-4">
                <thead>
                  <tr className="bg-neutral-100 border-b border-neutral-300">
                    <th className="p-2 text-left">N° Dossier</th>
                    <th className="p-2 text-left">Client</th>
                    <th className="p-2 text-left">Navire</th>
                    <th className="p-2 text-right">TTC 18%</th>
                    <th className="p-2 text-right">Debours 0%</th>
                    <th className="p-2 text-right">Total TTC</th>
                    <th className="p-2 text-center">Statut</th>
                    <th className="p-2 text-left">Code MECeF / Action</th>
                  </tr>
                </thead>
                <tbody>
                  {batchQueue.map((row) => (
                    <tr key={row.id} className="border-b border-neutral-200">
                      <td className="p-2 font-bold">{row.dossier_ref}</td>
                      <td className="p-2">{row.client_name}</td>
                      <td className="p-2">{row.vessel_name}</td>
                      <td className="p-2 text-right font-mono">{row.taxable.toLocaleString('fr-FR')}</td>
                      <td className="p-2 text-right font-mono">{row.debours.toLocaleString('fr-FR')}</td>
                      <td className="p-2 text-right font-mono font-bold">{row.total.toLocaleString('fr-FR')}</td>
                      <td className="p-2 text-center font-bold">
                        {row.status === 'NORMALISE' && (
                          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-900 rounded text-[10px]">
                            ACCEPTEE
                          </span>
                        )}
                        {row.status === 'EN_COURS' && (
                          <span className="px-2 py-0.5 bg-amber-100 text-amber-900 rounded text-[10px]">
                            EN COURS...
                          </span>
                        )}
                        {row.status === 'EN_ATTENTE' && (
                          <span className="px-2 py-0.5 bg-neutral-200 text-neutral-700 rounded text-[10px]">
                            PRET
                          </span>
                        )}
                        {row.status === 'ERREUR' && (
                          <span className="px-2 py-0.5 bg-red-100 text-red-900 rounded text-[10px]">
                            ERREUR
                          </span>
                        )}
                      </td>
                      <td className="p-2 font-mono text-[11px]">
                        {row.code_mecef ? (
                          <div className="flex items-center justify-between">
                            <span>{row.code_mecef}</span>
                            <button
                              type="button"
                              onClick={() => triggerPdfDownload(row.invoice_id)}
                              className="px-2 py-0.5 bg-neutral-900 text-white rounded text-[10px] font-sans font-bold"
                            >
                              PDF
                            </button>
                          </div>
                        ) : (
                          <span className="text-red-600 font-sans">{row.error || '-'}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* MODE 3 : HISTORIQUE COMPLET */}
      {mode === 'journal' && (
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-6xl mx-auto bg-white border border-neutral-300 rounded shadow-sm p-4">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-neutral-200">
              <h2 className="font-bold text-sm uppercase">
                Historique Complet des Factures Certifiees ({recentInvoices.length})
              </h2>
              <input
                type="text"
                placeholder="Rechercher dossier, client, Code MECeF..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  fetchInvoices(e.target.value);
                }}
                className="border border-neutral-300 rounded px-3 py-1.5 text-xs w-72 outline-none"
              />
            </div>

            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-neutral-100 border-b border-neutral-300">
                  <th className="p-2.5">Date / Heure DGI</th>
                  <th className="p-2.5">Entite</th>
                  <th className="p-2.5">Type</th>
                  <th className="p-2.5">N° Dossier</th>
                  <th className="p-2.5">Client</th>
                  <th className="p-2.5">Navire</th>
                  <th className="p-2.5 text-right">Total TTC</th>
                  <th className="p-2.5">Code MECeF / DGI</th>
                  <th className="p-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {recentInvoices.map((inv) => (
                  <tr key={inv.id} className="border-b border-neutral-200 hover:bg-neutral-50">
                    <td className="p-2.5 font-mono text-[11px]">{inv.date_time}</td>
                    <td className="p-2.5 font-bold">{inv.entity}</td>
                    <td className="p-2.5 font-bold">{inv.invoice_type}</td>
                    <td className="p-2.5 font-bold">{inv.dossier_ref}</td>
                    <td className="p-2.5">{inv.client_name}</td>
                    <td className="p-2.5">{inv.vessel_name || '-'}</td>
                    <td className="p-2.5 text-right font-mono font-bold">
                      {Number(inv.total_ttc).toLocaleString('fr-FR')} FCFA
                    </td>
                    <td className="p-2.5 font-mono text-[11px]">{inv.code_mecef}</td>
                    <td className="p-2.5 text-right space-x-2">
                      <button
                        type="button"
                        onClick={() => setPreviewInvoice(inv)}
                        className="px-2.5 py-1 border border-neutral-300 rounded font-bold hover:bg-neutral-100"
                      >
                        Apercu A4
                      </button>
                      <button
                        type="button"
                        onClick={() => triggerPdfDownload(inv.id)}
                        className="px-2.5 py-1 bg-neutral-900 text-white rounded font-bold hover:bg-neutral-800"
                      >
                        Telecharger PDF
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL APERCU FACTURE A4 OFFICIELLE */}
      {previewInvoice && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-neutral-100 rounded shadow-2xl max-w-[840px] w-full max-h-[92vh] flex flex-col overflow-hidden">
            <div className="no-print bg-neutral-900 text-white px-4 py-2.5 flex items-center justify-between">
              <span className="font-bold text-xs uppercase">
                Apercu Facture Normalisee — Dossier {previewInvoice.dossier_ref} ({previewInvoice.code_mecef})
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => triggerPdfDownload(previewInvoice.id)}
                  className="px-3 py-1 bg-emerald-500 text-neutral-950 font-bold text-xs rounded flex items-center gap-1"
                >
                  <Download className="w-3.5 h-3.5" /> Telecharger le fichier PDF
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewInvoice(null)}
                  className="p-1 hover:bg-neutral-800 rounded"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-6 flex justify-center">
              <InvoiceSheetA4 invoice={previewInvoice} />
            </div>
          </div>
        </div>
      )}

      {/* MODAL ANTI-DOUBLON */}
      {duplicateModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded max-w-md w-full p-5 shadow-2xl border-2 border-neutral-900">
            <div className="flex items-center gap-2 font-bold text-sm uppercase mb-2">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
              Doublon Potentiel Detecte
            </div>
            <p className="text-xs text-neutral-700 leading-relaxed mb-4">
              {duplicateModal}
            </p>
            <div className="flex justify-end gap-2 text-xs font-bold">
              <button
                type="button"
                onClick={() => setDuplicateModal(null)}
                className="px-4 py-2 border border-neutral-300 rounded hover:bg-neutral-100"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => handleSubmit(true)}
                className="px-4 py-2 bg-neutral-900 text-white rounded hover:bg-neutral-800"
              >
                Confirmer et Emettre quand meme
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
