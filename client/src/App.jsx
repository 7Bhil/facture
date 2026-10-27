import { useState, useEffect, useMemo } from 'react';
import {
  ShieldCheck,
  Printer,
  AlertTriangle,
  FileText,
  CheckCircle2,
  AlertCircle,
  Plus,
  Trash2,
  History,
  FilePlus2,
  RefreshCw,
  Search,
  Upload,
  RotateCcw
} from 'lucide-react';
import InvoiceSheetA4 from './InvoiceSheetA4';

const API_BASE = 'http://127.0.0.1:3001';

const TAX_GROUPS = [
  { value: 'B', label: 'Groupe B - Taxable TVA (18%)', rate: 18 },
  { value: 'A', label: 'Groupe A - Exonere / Debours (0%)', rate: 0 },
  { value: 'C', label: 'Groupe C - Exportation (0%)', rate: 0 },
  { value: 'D', label: 'Groupe D - TVA Exception (18%)', rate: 18 },
  { value: 'E', label: 'Groupe E - Regime TPS (0%)', rate: 0 },
  { value: 'F', label: 'Groupe F - Reserve (0%)', rate: 0 }
];

const PAYMENT_TYPES = [
  { value: 'VIREMENT', label: 'VIREMENT BANCAIRE' },
  { value: 'CHEQUES', label: 'CHEQUE' },
  { value: 'ESPECES', label: 'ESPECES' },
  { value: 'CREDIT', label: 'A CREDIT' },
  { value: 'MOBILEMONEY', label: 'MOBILE MONEY' },
  { value: 'CARTEBANCAIRE', label: 'CARTE BANCAIRE' },
  { value: 'AUTRE', label: 'AUTRE' }
];

const INVOICE_TYPES = [
  { value: 'FV', label: 'FV - Facture de Vente' },
  { value: 'FA', label: "FA - Facture d'Avoir" },
  { value: 'EV', label: "EV - Facture de Vente a l'Exportation" },
  { value: 'EA', label: "EA - Facture d'Avoir a l'Exportation" }
];

function createEmptyItem(name = '', taxGroup = 'B', priceTtc = '', code = '') {
  return {
    id: Math.random().toString(36).substring(2, 9),
    code,
    name,
    tax_group: taxGroup,
    input_mode: 'TTC', // 'TTC' ou 'HT'
    raw_price: priceTtc,
    quantity: 1,
    tax_specific: 0
  };
}

function computeUnitPriceTtc(item) {
  const raw = Number(item.raw_price) || 0;
  if (raw <= 0) return 0;
  const isTaxable18 = item.tax_group === 'B' || item.tax_group === 'D';
  if (item.input_mode === 'HT' && isTaxable18) {
    return Math.round(raw * 1.18);
  }
  return Math.round(raw);
}

export default function App() {
  const [activeTab, setActiveTab] = useState('form'); // 'form' | 'journal'
  const [entity, setEntity] = useState('AGL');
  const [emcfStatus, setEmcfStatus] = useState(null);
  const [statusLoading, setStatusLoading] = useState(false);

  // Donnees catalogue et historique
  const [catalog, setCatalog] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [journalSearch, setJournalSearch] = useState('');
  const [journalTypeFilter, setJournalTypeFilter] = useState('');

  // Etat du formulaire de facturation
  const [dossierRef, setDossierRef] = useState('');
  const [invoiceType, setInvoiceType] = useState('FV');
  const [originalMecefCode, setOriginalMecefCode] = useState('');
  const [clientIfu, setClientIfu] = useState('');
  const [clientName, setClientName] = useState('');
  const [clientAddress, setClientAddress] = useState('');
  const [clientContact, setClientContact] = useState('');
  const [vesselName, setVesselName] = useState('');
  const [arrivalDate, setArrivalDate] = useState('');
  const [blNumber, setBlNumber] = useState('');
  const [paymentType, setPaymentType] = useState('VIREMENT');
  const [aibType, setAibType] = useState('');
  const [customMessage, setCustomMessage] = useState('');

  // Grille dynamique d'articles
  const [items, setItems] = useState([
    createEmptyItem('MANUTENTION PORTUAIRE ET ACCONAGE', 'B', '', 'SRV-MAN'),
    createEmptyItem('DEBOURS DROITS ET TAXES DE DOUANE', 'A', '', 'DEB-DOU')
  ]);

  // Zone d'import rapide Copier/Coller depuis Excel RECAP
  const [showPasteBox, setShowPasteBox] = useState(false);
  const [pasteText, setPasteText] = useState('');

  // Etats d'execution
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [infoBanner, setInfoBanner] = useState(null);
  const [duplicateWarning, setDuplicateWarning] = useState(null);
  const [normalizedData, setNormalizedData] = useState(null);

  // Chargement initial du catalogue, de l'historique et du statut e-MCF
  useEffect(() => {
    fetchCatalog();
    fetchInvoices();
  }, []);

  useEffect(() => {
    fetchEmcfStatus(entity);
  }, [entity]);

  const fetchEmcfStatus = async (ent) => {
    setStatusLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/emcf-status/${ent}`);
      const data = await res.json();
      if (data.success) {
        setEmcfStatus(data);
      }
    } catch {
      setEmcfStatus(null);
    } finally {
      setStatusLoading(false);
    }
  };

  const fetchCatalog = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/catalog`);
      const data = await res.json();
      if (data.success) setCatalog(data.items || []);
    } catch {
      // Silencieux si serveur indisponible
    }
  };

  const fetchInvoices = async (search = journalSearch, type = journalTypeFilter) => {
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (type) params.set('type', type);
      const res = await fetch(`${API_BASE}/api/invoices?${params.toString()}`);
      const data = await res.json();
      if (data.success) setInvoices(data.invoices || []);
    } catch {
      // Silencieux
    }
  };

  // Auto-completion du client des la saisie des 13 chiffres de l'IFU
  const handleIfuChange = async (val) => {
    const cleaned = val.replace(/\D/g, '').slice(0, 13);
    setClientIfu(cleaned);
    if (cleaned.length === 13) {
      try {
        const res = await fetch(`${API_BASE}/api/clients/lookup?ifu=${cleaned}`);
        const data = await res.json();
        if (data.success && data.client) {
          setClientName(data.client.name || '');
          setClientAddress(data.client.address || '');
          setClientContact(data.client.contact || '');
          setInfoBanner(`Client reconnu dans l'annuaire : ${data.client.name}`);
        }
      } catch {
        // Ignorer
      }
    }
  };

  // Purge des demandes en attente sur l'e-MCF
  const handleClearPending = async () => {
    if (!emcfStatus || !emcfStatus.pendingRequestsList?.length) return;
    setStatusLoading(true);
    try {
      const uids = emcfStatus.pendingRequestsList.map((p) => p.uid);
      await fetch(`${API_BASE}/api/emcf-pending/${entity}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uids })
      });
      await fetchEmcfStatus(entity);
      setInfoBanner(`${uids.length} demande(s) en attente annulee(s) sur l'e-MCF.`);
    } catch {
      setErrorMessage("Impossible d'annuler les factures en attente.");
    } finally {
      setStatusLoading(false);
    }
  };

  // Gestion des lignes d'articles
  const updateItem = (id, field, value) => {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, [field]: value } : it))
    );
    if (errorMessage) setErrorMessage(null);
  };

  const addItem = (name = '', taxGroup = 'B', price = '', code = '') => {
    setItems((prev) => [...prev, createEmptyItem(name, taxGroup, price, code)]);
  };

  const removeItem = (id) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((it) => it.id !== id));
  };

  const handleSelectCatalog = (e) => {
    const code = e.target.value;
    if (!code) return;
    const found = catalog.find((c) => c.code === code);
    if (found) {
      addItem(found.name, found.tax_group, found.default_price_ttc || '', found.code);
    }
    e.target.value = '';
  };

  // Import Copier/Coller depuis Excel RECAP
  const handleParsePaste = () => {
    if (!pasteText.trim()) return;
    const rows = pasteText.trim().split(/\r?\n/);
    const parsedItems = [];

    for (const row of rows) {
      const cols = row.split(/\t|;/).map((c) => c.trim());
      if (cols.length >= 2) {
        const label = cols[0];
        const rawAmount = Number(cols[1].replace(/\s/g, '').replace(',', '.')) || 0;
        const groupHint = (cols[2] || '').toUpperCase();
        const isDebours =
          groupHint === 'A' ||
          label.toUpperCase().includes('DEBOURS') ||
          label.toUpperCase().includes('DOUANE') ||
          label.toUpperCase().includes('PAC');

        if (label && rawAmount > 0) {
          parsedItems.push(createEmptyItem(label, isDebours ? 'A' : 'B', rawAmount));
        }
      }
    }

    if (parsedItems.length > 0) {
      setItems(parsedItems);
      setShowPasteBox(false);
      setPasteText('');
      setInfoBanner(`${parsedItems.length} ligne(s) importee(s) depuis le presse-papiers Excel.`);
    } else {
      setErrorMessage('Format non reconnu. Collez des lignes au format : Libelle [TAB] Montant [TAB] Groupe (A ou B).');
    }
  };

  // Pre-remplissage d'un Avoir (FA/EA) a partir d'une facture existante
  const loadInvoiceForCreditNote = (origInv) => {
    setEntity(origInv.entity);
    setInvoiceType(origInv.invoice_type === 'EV' ? 'EA' : 'FA');
    setDossierRef(`${origInv.dossier_ref}-AVOIR`);
    setOriginalMecefCode((origInv.code_mecef || '').replace(/[^A-Za-z0-9]/g, ''));
    setClientIfu(origInv.client_ifu || '');
    setClientName(origInv.client_name || '');
    setClientAddress(origInv.client_address || '');
    setClientContact(origInv.client_contact || '');
    setVesselName(origInv.vessel_name || '');
    setArrivalDate(origInv.arrival_date || '');
    setBlNumber(origInv.bl_number || '');
    setPaymentType(origInv.payment_type || 'VIREMENT');
    setAibType(origInv.aib_type || '');

    if (Array.isArray(origInv.items) && origInv.items.length > 0) {
      setItems(
        origInv.items.map((it) => ({
          id: Math.random().toString(36).substring(2, 9),
          code: it.code || '',
          name: it.name,
          tax_group: it.tax_group || 'B',
          input_mode: 'TTC',
          raw_price: it.unit_price_ttc,
          quantity: it.quantity,
          tax_specific: it.tax_specific || 0
        }))
      );
    }
    setActiveTab('form');
    setInfoBanner(`Formulaire pre-rempli pour l'emission d'un Avoir sur la facture ${origInv.dossier_ref} (${origInv.code_mecef}).`);
  };

  const resetForm = () => {
    setDossierRef('');
    setInvoiceType('FV');
    setOriginalMecefCode('');
    setClientIfu('');
    setClientName('');
    setClientAddress('');
    setClientContact('');
    setVesselName('');
    setArrivalDate('');
    setBlNumber('');
    setCustomMessage('');
    setErrorMessage(null);
    setInfoBanner(null);
    setItems([
      createEmptyItem('MANUTENTION PORTUAIRE ET ACCONAGE', 'B', '', 'SRV-MAN'),
      createEmptyItem('DEBOURS DROITS ET TAXES DE DOUANE', 'A', '', 'DEB-DOU')
    ]);
  };

  // Calcul arithmetique en temps reel avant soumission
  const liveTotals = useMemo(() => {
    let totalGroupA = 0;
    let totalGroupBTtc = 0;
    let totalOtherExon = 0;
    let totalSpecific = 0;

    for (const it of items) {
      const unitTtc = computeUnitPriceTtc(it);
      const qty = Number(it.quantity) || 0;
      const spec = Number(it.tax_specific) || 0;
      const lineTtc = Math.round(unitTtc * qty) + spec;
      totalSpecific += spec;

      if (it.tax_group === 'B' || it.tax_group === 'D') {
        totalGroupBTtc += lineTtc;
      } else if (it.tax_group === 'A') {
        totalGroupA += lineTtc;
      } else {
        totalOtherExon += lineTtc;
      }
    }

    const baseHtB = Math.round(totalGroupBTtc / 1.18);
    const tvaB = totalGroupBTtc - baseHtB;
    const totalTtc = totalGroupA + totalGroupBTtc + totalOtherExon;

    return {
      totalGroupA,
      totalGroupBTtc,
      baseHtB,
      tvaB,
      totalOtherExon,
      totalSpecific,
      totalTtc
    };
  }, [items]);

  // Soumission & Normalisation vers le serveur Express -> DGI
  const handleNormalize = async (force = false) => {
    setErrorMessage(null);
    setInfoBanner(null);
    setDuplicateWarning(null);

    if (!dossierRef.trim()) {
      setErrorMessage('Veuillez renseigner le numero de dossier / facture.');
      return;
    }
    if (!clientName.trim()) {
      setErrorMessage('Veuillez renseigner le nom / raison sociale du client.');
      return;
    }

    // Filtrer uniquement les lignes qui ont un prix > 0 ou alerter si une ligne remplie a un prix nul
    const activeItems = items
      .map((it) => ({
        ...it,
        unit_price_ttc: computeUnitPriceTtc(it)
      }))
      .filter((it) => it.unit_price_ttc > 0 && it.name.trim() !== '');

    if (activeItems.length === 0) {
      setErrorMessage('Veuillez saisir au moins une ligne d article avec un libelle et un montant superieur a 0.');
      return;
    }

    if (invoiceType === 'FA' || invoiceType === 'EA') {
      const cleanOrig = originalMecefCode.replace(/[^A-Za-z0-9]/g, '');
      if (cleanOrig.length !== 24) {
        setErrorMessage(`Pour une facture d avoir (${invoiceType}), le Code MECeF de la facture originale doit comporter exactement 24 caracteres alphanumeriques.`);
        return;
      }
    }

    setLoading(true);
    try {
      const payload = {
        entity,
        dossier_ref: dossierRef.trim(),
        invoice_type: invoiceType,
        original_mecef_code: originalMecefCode,
        client: {
          ifu: clientIfu.trim(),
          name: clientName.trim(),
          address: clientAddress.trim(),
          contact: clientContact.trim()
        },
        vessel_name: vesselName.trim(),
        arrival_date: arrivalDate,
        bl_number: blNumber.trim(),
        custom_message: customMessage.trim(),
        aib_type: aibType || null,
        payment_type: paymentType,
        items: activeItems,
        force
      };

      const res = await fetch(`${API_BASE}/api/normalize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (data.requires_confirmation) {
        setDuplicateWarning(data.message);
      } else if (data.success) {
        setNormalizedData(data.data);
        setInfoBanner(data.message);
        fetchInvoices();
        fetchEmcfStatus(entity);
      } else {
        setErrorMessage(data.message || 'Erreur lors de la normalisation DGI.');
      }
    } catch {
      setErrorMessage('Impossible de communiquer avec le serveur local (port 3001).');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-neutral-100 text-neutral-900 font-sans">
      
      {/* Barre superieure de commande et de statut e-MCF */}
      <header className="no-print bg-neutral-900 text-white px-6 py-3 flex items-center justify-between border-b border-neutral-800 flex-shrink-0">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-5 h-5 text-neutral-300" />
            <div>
              <div className="font-bold text-sm tracking-wider uppercase">PLATEFORME e-MECeF DGI</div>
              <div className="text-[11px] text-neutral-400">Normalisation Fiscale AGL Benin & SOCOPAO</div>
            </div>
          </div>

          {/* Selecteur d'Entite */}
          <div className="flex items-center bg-neutral-800 rounded p-0.5 border border-neutral-700">
            {['AGL', 'SOCOPAO'].map((ent) => (
              <button
                key={ent}
                onClick={() => setEntity(ent)}
                className={`px-3 py-1 text-xs font-bold rounded transition ${
                  entity === ent
                    ? 'bg-white text-neutral-900 shadow-sm'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                {ent === 'AGL' ? 'AGL BENIN' : 'SOCOPAO'}
              </button>
            ))}
          </div>

          {/* Onglets de navigation */}
          <nav className="flex items-center gap-1 ml-2">
            <button
              onClick={() => setActiveTab('form')}
              className={`px-3 py-1.5 rounded text-xs font-semibold flex items-center gap-1.5 transition ${
                activeTab === 'form'
                  ? 'bg-neutral-700 text-white'
                  : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
              }`}
            >
              <FilePlus2 className="w-3.5 h-3.5" /> Emission de Facture
            </button>
            <button
              onClick={() => {
                setActiveTab('journal');
                fetchInvoices();
              }}
              className={`px-3 py-1.5 rounded text-xs font-semibold flex items-center gap-1.5 transition ${
                activeTab === 'journal'
                  ? 'bg-neutral-700 text-white'
                  : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
              }`}
            >
              <History className="w-3.5 h-3.5" /> Journal des Factures ({invoices.length})
            </button>
          </nav>
        </div>

        {/* Statut e-MCF en direct */}
        <div className="flex items-center gap-4 text-xs">
          {emcfStatus ? (
            <div className="flex items-center gap-3 bg-neutral-800 border border-neutral-700 px-3 py-1.5 rounded">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-400"></span>
              <span>
                NIM : <strong className="font-mono">{emcfStatus.nim}</strong>
              </span>
              <span className="text-neutral-500">|</span>
              <span>
                IFU : <strong className="font-mono">{emcfStatus.ifu}</strong>
              </span>
              {emcfStatus.pendingRequestsCount > 0 && (
                <>
                  <span className="text-neutral-500">|</span>
                  <button
                    onClick={handleClearPending}
                    className="text-amber-300 hover:underline font-semibold"
                    title="Purger les factures en attente sur le serveur DGI"
                  >
                    {emcfStatus.pendingRequestsCount} en attente (Purger)
                  </button>
                </>
              )}
            </div>
          ) : (
            <span className="text-neutral-400"> Verification e-MCF...</span>
          )}
          <button
            onClick={() => fetchEmcfStatus(entity)}
            disabled={statusLoading}
            className="p-1.5 bg-neutral-800 hover:bg-neutral-700 rounded border border-neutral-700 text-neutral-300"
            title="Rafraichir la connexion DGI"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${statusLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </header>

      {/* VUE 1 : EMISSION ET APERCU FACTURE A4 */}
      {activeTab === 'form' ? (
        <div className="flex flex-1 overflow-hidden">
          
          {/* Colonne Gauche : Formulaire Complet Multi-Articles */}
          <div className="no-print w-[620px] bg-white border-r border-neutral-300 flex flex-col h-full overflow-y-auto p-5 gap-4 text-xs flex-shrink-0">
            
            <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
              <div>
                <h2 className="font-bold text-sm uppercase tracking-wide text-neutral-900">
                  Saisie et Ventilation du Dossier ({entity})
                </h2>
                <p className="text-[11px] text-neutral-500">
                  Ajoutez toutes les rubriques taxables et debours du dossier avant normalisation.
                </p>
              </div>
              <button
                onClick={resetForm}
                className="px-2.5 py-1 border border-neutral-300 rounded hover:bg-neutral-100 text-neutral-700 font-semibold flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" /> Nouveau
              </button>
            </div>

            {/* Bandeaux d'erreur et d'information */}
            {errorMessage && (
              <div className="bg-red-50 border border-red-300 text-red-900 p-3 rounded flex items-start gap-2">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-red-700" />
                <div className="font-medium leading-relaxed">{errorMessage}</div>
              </div>
            )}

            {infoBanner && (
              <div className="bg-neutral-100 border border-neutral-300 text-neutral-800 p-2.5 rounded flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0 text-neutral-700" />
                <div className="font-medium leading-relaxed">{infoBanner}</div>
              </div>
            )}

            {/* Section 1 : Type de Facture et Reference Dossier */}
            <div className="border border-neutral-200 rounded p-3.5 bg-neutral-50 space-y-3">
              <div className="font-bold text-[11px] uppercase tracking-wider text-neutral-600">
                1. Nature de la Facture & Reference Dossier
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-neutral-700 block mb-1">Type de Facture DGI *</label>
                  <select
                    value={invoiceType}
                    onChange={(e) => setInvoiceType(e.target.value)}
                    className="w-full border border-neutral-300 rounded px-2.5 py-1.5 bg-white font-semibold outline-none focus:border-neutral-900"
                  >
                    {INVOICE_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-neutral-700 block mb-1">N° Dossier / Facture Interne *</label>
                  <input
                    type="text"
                    placeholder="Ex: DOS-2026-8461"
                    value={dossierRef}
                    onChange={(e) => setDossierRef(e.target.value)}
                    className="w-full border border-neutral-300 rounded px-2.5 py-1.5 bg-white outline-none focus:border-neutral-900 font-semibold"
                  />
                </div>
              </div>

              {/* Champ conditionnel obligatoire si Facture d'Avoir (FA / EA) */}
              {(invoiceType === 'FA' || invoiceType === 'EA') && (
                <div className="pt-2 border-t border-neutral-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-neutral-900">
                      Code MECeF de la Facture Originale (24 caracteres) *
                    </label>
                    <select
                      onChange={(e) => {
                        const inv = invoices.find((i) => String(i.id) === e.target.value);
                        if (inv) {
                          setOriginalMecefCode((inv.code_mecef || '').replace(/[^A-Za-z0-9]/g, ''));
                        }
                      }}
                      className="text-[11px] border border-neutral-300 rounded px-2 py-0.5 bg-white"
                    >
                      <option value="">Choisir depuis une facture de vente existante...</option>
                      {invoices
                        .filter((i) => i.invoice_type === 'FV' || i.invoice_type === 'EV')
                        .map((i) => (
                          <option key={i.id} value={i.id}>
                            {i.dossier_ref} - {i.client_name} ({i.code_mecef})
                          </option>
                        ))}
                    </select>
                  </div>
                  <input
                    type="text"
                    placeholder="Ex: TEST2JVCNKKP4MPJXPM2L6AO (sans les tirets)"
                    value={originalMecefCode}
                    onChange={(e) => setOriginalMecefCode(e.target.value)}
                    className="w-full border border-neutral-400 rounded px-2.5 py-1.5 bg-white font-mono uppercase outline-none focus:border-neutral-900"
                  />
                </div>
              )}
            </div>

            {/* Section 2 : Identification Client */}
            <div className="border border-neutral-200 rounded p-3.5 space-y-3">
              <div className="font-bold text-[11px] uppercase tracking-wider text-neutral-600">
                2. Identification du Client (Acheteur)
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="font-semibold text-neutral-700 block mb-1">IFU Client (13 chiffres)</label>
                  <input
                    type="text"
                    maxLength={13}
                    placeholder="Vide si etranger"
                    value={clientIfu}
                    onChange={(e) => handleIfuChange(e.target.value)}
                    className="w-full border border-neutral-300 rounded px-2.5 py-1.5 font-mono outline-none focus:border-neutral-900"
                  />
                </div>
                <div className="col-span-2">
                  <label className="font-semibold text-neutral-700 block mb-1">Nom / Raison Sociale Client *</label>
                  <input
                    type="text"
                    placeholder="Raison sociale ou nom complet"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    className="w-full border border-neutral-300 rounded px-2.5 py-1.5 outline-none focus:border-neutral-900 font-semibold"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-neutral-700 block mb-1">Adresse</label>
                  <input
                    type="text"
                    placeholder="Adresse geographique"
                    value={clientAddress}
                    onChange={(e) => setClientAddress(e.target.value)}
                    className="w-full border border-neutral-300 rounded px-2.5 py-1.5 outline-none focus:border-neutral-900"
                  />
                </div>
                <div>
                  <label className="font-semibold text-neutral-700 block mb-1">Telephone / Email</label>
                  <input
                    type="text"
                    placeholder="Contact client"
                    value={clientContact}
                    onChange={(e) => setClientContact(e.target.value)}
                    className="w-full border border-neutral-300 rounded px-2.5 py-1.5 outline-none focus:border-neutral-900"
                  />
                </div>
              </div>
            </div>

            {/* Section 3 : Mentions Maritimes */}
            <div className="border border-neutral-200 rounded p-3.5 space-y-2.5">
              <div className="font-bold text-[11px] uppercase tracking-wider text-neutral-600">
                3. Mentions Maritimes (Navire, Escale, Connaissement)
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="font-semibold text-neutral-700 block mb-1">Nom du Navire</label>
                  <input
                    type="text"
                    placeholder="Ex: MSC LAURA"
                    value={vesselName}
                    onChange={(e) => setVesselName(e.target.value)}
                    className="w-full border border-neutral-300 rounded px-2.5 py-1.5 outline-none focus:border-neutral-900"
                  />
                </div>
                <div>
                  <label className="font-semibold text-neutral-700 block mb-1">Date d'Arrivee</label>
                  <input
                    type="date"
                    value={arrivalDate}
                    onChange={(e) => setArrivalDate(e.target.value)}
                    className="w-full border border-neutral-300 rounded px-2.5 py-1.5 outline-none focus:border-neutral-900"
                  />
                </div>
                <div>
                  <label className="font-semibold text-neutral-700 block mb-1">N° BL / Connaissement</label>
                  <input
                    type="text"
                    placeholder="Ex: MEDU1234567"
                    value={blNumber}
                    onChange={(e) => setBlNumber(e.target.value)}
                    className="w-full border border-neutral-300 rounded px-2.5 py-1.5 outline-none focus:border-neutral-900"
                  />
                </div>
              </div>
            </div>

            {/* Section 4 : Grille Dynamique Multi-Articles */}
            <div className="border border-neutral-300 rounded p-3.5 space-y-3 bg-white">
              <div className="flex items-center justify-between">
                <div className="font-bold text-[11px] uppercase tracking-wider text-neutral-800">
                  4. Rubriques de Facturation & Ventilation Fiscale ({items.length} ligne{items.length > 1 ? 's' : ''})
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowPasteBox(!showPasteBox)}
                    className="px-2 py-1 border border-neutral-300 rounded text-[11px] font-semibold hover:bg-neutral-100 flex items-center gap-1"
                  >
                    <Upload className="w-3 h-3" /> Coller depuis Excel
                  </button>
                  <button
                    type="button"
                    onClick={() => addItem('', 'B', '')}
                    className="px-2.5 py-1 bg-neutral-900 text-white rounded text-[11px] font-semibold hover:bg-neutral-800 flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" /> Ajouter Ligne
                  </button>
                </div>
              </div>

              {/*Ajout rapide depuis le catalogue preprogramme */}
              <div>
                <select
                  onChange={handleSelectCatalog}
                  defaultValue=""
                  className="w-full border border-neutral-300 rounded px-2.5 py-1.5 bg-neutral-50 text-neutral-700 text-[11px] outline-none focus:border-neutral-900"
                >
                  <option value="">+ Inserer rapidement une rubrique preprogrammee AGL / SOCOPAO...</option>
                  {catalog.map((cat) => (
                    <option key={cat.code} value={cat.code}>
                      [{cat.tax_group}] {cat.name} ({cat.category})
                    </option>
                  ))}
                </select>
              </div>

              {/* Zone Copier/Coller depuis Excel RECAP */}
              {showPasteBox && (
                <div className="bg-neutral-50 border border-neutral-300 rounded p-3 space-y-2">
                  <div className="text-[11px] font-semibold text-neutral-700">
                    Collez vos lignes depuis Excel (Format : Libelle [TAB] Montant TTC [TAB] Groupe A ou B) :
                  </div>
                  <textarea
                    rows={3}
                    placeholder={"MANUTENTION CONTENEUR\t118000\tB\nDEBOURS DOUANE\t50000\tA"}
                    value={pasteText}
                    onChange={(e) => setPasteText(e.target.value)}
                    className="w-full border border-neutral-300 rounded p-2 font-mono text-[11px] outline-none"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowPasteBox(false)}
                      className="px-2.5 py-1 border border-neutral-300 rounded text-[11px]"
                    >
                      Fermer
                    </button>
                    <button
                      type="button"
                      onClick={handleParsePaste}
                      className="px-3 py-1 bg-neutral-900 text-white rounded text-[11px] font-semibold"
                    >
                      Importer les lignes
                    </button>
                  </div>
                </div>
              )}

              {/* Liste des lignes d'articles */}
              <div className="space-y-2.5">
                {items.map((item, idx) => {
                  const unitTtc = computeUnitPriceTtc(item);
                  const lineTotalTtc = Math.round(unitTtc * (Number(item.quantity) || 0)) + (Number(item.tax_specific) || 0);
                  const isTax18 = item.tax_group === 'B' || item.tax_group === 'D';
                  const lineHt = isTax18 ? Math.round(lineTotalTtc / 1.18) : lineTotalTtc;
                  const lineTva = lineTotalTtc - lineHt;

                  return (
                    <div
                      key={item.id}
                      className="border border-neutral-200 rounded p-2.5 bg-neutral-50/70 space-y-2"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-neutral-500 w-5">#{idx + 1}</span>
                        <input
                          type="text"
                          placeholder="Designation de la prestation ou du debours..."
                          value={item.name}
                          onChange={(e) => updateItem(item.id, 'name', e.target.value)}
                          className="flex-1 border border-neutral-300 rounded px-2.5 py-1 bg-white font-semibold outline-none focus:border-neutral-900"
                        />
                        <button
                          type="button"
                          onClick={() => removeItem(item.id)}
                          disabled={items.length <= 1}
                          className="p-1 text-neutral-400 hover:text-red-600 disabled:opacity-30"
                          title="Supprimer cette ligne"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="grid grid-cols-12 gap-2 items-end pl-7">
                        <div className="col-span-5">
                          <label className="text-[10px] font-semibold text-neutral-500 block mb-0.5">
                            Groupe Fiscal DGI
                          </label>
                          <select
                            value={item.tax_group}
                            onChange={(e) => updateItem(item.id, 'tax_group', e.target.value)}
                            className="w-full border border-neutral-300 rounded px-2 py-1 bg-white text-[11px] font-medium outline-none"
                          >
                            {TAX_GROUPS.map((g) => (
                              <option key={g.value} value={g.value}>{g.label}</option>
                            ))}
                          </select>
                        </div>

                        <div className="col-span-2">
                          <label className="text-[10px] font-semibold text-neutral-500 block mb-0.5">
                            Mode Saisie
                          </label>
                          <select
                            value={item.input_mode}
                            onChange={(e) => updateItem(item.id, 'input_mode', e.target.value)}
                            className="w-full border border-neutral-300 rounded px-1.5 py-1 bg-white text-[11px] font-semibold outline-none"
                          >
                            <option value="TTC">Prix TTC</option>
                            <option value="HT">Prix HT</option>
                          </select>
                        </div>

                        <div className="col-span-3">
                          <label className="text-[10px] font-semibold text-neutral-500 block mb-0.5">
                            Montant ({item.input_mode})
                          </label>
                          <input
                            type="number"
                            min="0"
                            placeholder="0"
                            value={item.raw_price}
                            onChange={(e) => updateItem(item.id, 'raw_price', e.target.value)}
                            className="w-full border border-neutral-300 rounded px-2 py-1 bg-white font-bold text-right outline-none focus:border-neutral-900"
                          />
                        </div>

                        <div className="col-span-2">
                          <label className="text-[10px] font-semibold text-neutral-500 block mb-0.5">
                            Qte
                          </label>
                          <input
                            type="number"
                            min="0.01"
                            step="any"
                            value={item.quantity}
                            onChange={(e) => updateItem(item.id, 'quantity', e.target.value)}
                            className="w-full border border-neutral-300 rounded px-2 py-1 bg-white text-right outline-none focus:border-neutral-900"
                          />
                        </div>
                      </div>

                      {lineTotalTtc > 0 && (
                        <div className="pl-7 flex justify-between items-center text-[10px] text-neutral-600 pt-1 border-t border-neutral-200/70">
                          <span>
                            {isTax18
                              ? `Base HT : ${lineHt.toLocaleString('fr-FR')} FCFA | TVA (18%) : ${lineTva.toLocaleString('fr-FR')} FCFA`
                              : 'Exonere de TVA (0%)'}
                          </span>
                          <span className="font-bold text-neutral-900">
                            Sous-total TTC : {lineTotalTtc.toLocaleString('fr-FR')} FCFA [{item.tax_group}]
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Section 5 : Paiement, AIB et Message */}
            <div className="border border-neutral-200 rounded p-3.5 space-y-3">
              <div className="font-bold text-[11px] uppercase tracking-wider text-neutral-600">
                5. Reglement & Options Fiscales
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-neutral-700 block mb-1">Mode de Paiement</label>
                  <select
                    value={paymentType}
                    onChange={(e) => setPaymentType(e.target.value)}
                    className="w-full border border-neutral-300 rounded px-2.5 py-1.5 bg-white font-medium outline-none"
                  >
                    {PAYMENT_TYPES.map((p) => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-neutral-700 block mb-1">Retenue AIB</label>
                  <select
                    value={aibType}
                    onChange={(e) => setAibType(e.target.value)}
                    className="w-full border border-neutral-300 rounded px-2.5 py-1.5 bg-white font-medium outline-none"
                  >
                    <option value="">Aucun AIB (0%)</option>
                    <option value="A">AIB Type A (1%)</option>
                    <option value="B">AIB Type B (5%)</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="font-semibold text-neutral-700 block mb-1">Message Commercial / Pied de page (Optionnel)</label>
                <input
                  type="text"
                  placeholder="Ex: Merci de votre confiance."
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                  className="w-full border border-neutral-300 rounded px-2.5 py-1.5 outline-none"
                />
              </div>
            </div>

            {/* Section 6 : Synthese Arithmetique et Bouton d'Emission */}
            <div className="bg-neutral-900 text-white rounded p-4 space-y-2">
              <div className="flex justify-between text-neutral-300 text-[11px]">
                <span>Prestations Imposables HT (Grp B/D) :</span>
                <span className="font-mono">{liveTotals.baseHtB.toLocaleString('fr-FR')} FCFA</span>
              </div>
              <div className="flex justify-between text-neutral-300 text-[11px]">
                <span>TVA 18% (Grp B/D) :</span>
                <span className="font-mono">{liveTotals.tvaB.toLocaleString('fr-FR')} FCFA</span>
              </div>
              <div className="flex justify-between text-neutral-300 text-[11px]">
                <span>Debours / Exonere (Grp A/C/E/F) :</span>
                <span className="font-mono">{(liveTotals.totalGroupA + liveTotals.totalOtherExon).toLocaleString('fr-FR')} FCFA</span>
              </div>
              <div className="border-t border-neutral-700 pt-2 flex justify-between items-center font-bold text-sm">
                <span>TOTAL GENERAL TTC :</span>
                <span className="font-mono text-base">{liveTotals.totalTtc.toLocaleString('fr-FR')} FCFA</span>
              </div>

              <button
                type="button"
                onClick={() => handleNormalize(false)}
                disabled={loading}
                className="w-full mt-2 bg-white hover:bg-neutral-200 disabled:bg-neutral-600 disabled:text-neutral-400 text-neutral-900 font-bold py-2.5 rounded transition uppercase tracking-wider text-xs"
              >
                {loading ? 'TRANSMISSION ET CERTIFICATION DGI EN COURS...' : 'VALIDER ET NORMALISER LA FACTURE'}
              </button>
            </div>
          </div>

          {/* Colonne Droite : Rendu Facture A4 SyGMEF (Option B) */}
          <div className="flex-1 overflow-y-auto p-6 flex flex-col items-center justify-start bg-neutral-200/70">
            {normalizedData ? (
              <>
                <div className="no-print w-full max-w-[794px] flex items-center justify-between bg-white border border-neutral-300 px-4 py-2.5 rounded mb-4 shadow-sm">
                  <div className="flex items-center gap-2 text-xs font-semibold text-neutral-800">
                    <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                    <span>
                      Code MECeF : <strong className="font-mono">{normalizedData.code_mecef}</strong>
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {(normalizedData.invoice_type === 'FV' || normalizedData.invoice_type === 'EV') && (
                      <button
                        onClick={() => loadInvoiceForCreditNote(normalizedData)}
                        className="px-3 py-1.5 border border-neutral-400 hover:bg-neutral-100 rounded text-xs font-semibold"
                      >
                        Emettre un Avoir (FA)
                      </button>
                    )}
                    <button
                      onClick={() => window.print()}
                      className="bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-bold px-4 py-1.5 rounded flex items-center gap-1.5 shadow-sm"
                    >
                      <Printer className="w-4 h-4" /> Imprimer / Telecharger PDF (A4)
                    </button>
                  </div>
                </div>

                <InvoiceSheetA4 invoice={normalizedData} />
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-neutral-500 gap-3 max-w-md text-center">
                <FileText className="w-14 h-14 stroke-1 text-neutral-400" />
                <div className="font-semibold text-sm text-neutral-700">
                  Apercu Officiel A4 SyGMEF (Option B)
                </div>
                <p className="text-xs text-neutral-500 leading-relaxed">
                  Completez les rubriques du dossier a gauche et validez pour obtenir la facture A4 certifiee par la DGI avec son QR Code et sa ventilation fiscale officielle.
                </p>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* VUE 2 : JOURNAL / HISTORIQUE DES FACTURES NORMALISEES */
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-6xl mx-auto bg-white border border-neutral-300 rounded shadow-sm">
            <div className="p-4 border-b border-neutral-200 flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="font-bold text-sm uppercase tracking-wide">
                  Journal des Factures Normalisees
                </h2>
                <p className="text-xs text-neutral-500">
                  Historique local certifie avec reimpression PDF et emission rapide de factures d'avoir.
                </p>
              </div>

              <div className="flex items-center gap-2 text-xs">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-neutral-400" />
                  <input
                    type="text"
                    placeholder="Dossier, client, navire, MECeF..."
                    value={journalSearch}
                    onChange={(e) => {
                      setJournalSearch(e.target.value);
                      fetchInvoices(e.target.value, journalTypeFilter);
                    }}
                    className="pl-8 pr-3 py-1.5 border border-neutral-300 rounded w-64 outline-none focus:border-neutral-900"
                  />
                </div>
                <select
                  value={journalTypeFilter}
                  onChange={(e) => {
                    setJournalTypeFilter(e.target.value);
                    fetchInvoices(journalSearch, e.target.value);
                  }}
                  className="border border-neutral-300 rounded px-2.5 py-1.5 bg-white outline-none"
                >
                  <option value="">Tous les types</option>
                  <option value="FV">FV - Vente</option>
                  <option value="FA">FA - Avoir</option>
                  <option value="EV">EV - Export Vente</option>
                  <option value="EA">EA - Export Avoir</option>
                </select>
              </div>
            </div>

            {invoices.length === 0 ? (
              <div className="p-12 text-center text-neutral-500 text-xs">
                Aucune facture enregistree pour ces criteres.
              </div>
            ) : (
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-neutral-100 border-b border-neutral-300 text-neutral-700">
                    <th className="py-2.5 px-3">Date DGI</th>
                    <th className="py-2.5 px-3">Entite</th>
                    <th className="py-2.5 px-3">Type</th>
                    <th className="py-2.5 px-3">N° Dossier</th>
                    <th className="py-2.5 px-3">Client</th>
                    <th className="py-2.5 px-3">Navire</th>
                    <th className="py-2.5 px-3 text-right">Total TTC</th>
                    <th className="py-2.5 px-3">Code MECeF / DGI</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="border-b border-neutral-200 hover:bg-neutral-50">
                      <td className="py-2.5 px-3 font-mono text-[11px]">{inv.date_time}</td>
                      <td className="py-2.5 px-3 font-bold">{inv.entity}</td>
                      <td className="py-2.5 px-3">
                        <span className="px-2 py-0.5 rounded bg-neutral-200 font-bold text-[10px]">
                          {inv.invoice_type}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-semibold">{inv.dossier_ref}</td>
                      <td className="py-2.5 px-3">{inv.client_name}</td>
                      <td className="py-2.5 px-3 text-neutral-600">{inv.vessel_name || '-'}</td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold">
                        {Number(inv.total_ttc).toLocaleString('fr-FR')} FCFA
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[11px]">{inv.code_mecef}</td>
                      <td className="py-2.5 px-3 text-right space-x-2">
                        <button
                          onClick={() => {
                            setNormalizedData(inv);
                            setActiveTab('form');
                          }}
                          className="px-2.5 py-1 bg-neutral-900 text-white rounded text-[11px] font-semibold hover:bg-neutral-800"
                        >
                          Afficher / PDF
                        </button>
                        {(inv.invoice_type === 'FV' || inv.invoice_type === 'EV') && (
                          <button
                            onClick={() => loadInvoiceForCreditNote(inv)}
                            className="px-2.5 py-1 border border-neutral-400 rounded text-[11px] font-semibold hover:bg-neutral-100"
                          >
                            Creer Avoir
                          </button>
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

      {/* Modal d'Alerte Idempotence / Anti-Doublon */}
      {duplicateWarning && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded max-w-md w-full p-6 shadow-2xl border border-neutral-300">
            <div className="flex items-center gap-2.5 text-neutral-900 mb-3">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              <h3 className="font-bold text-sm uppercase">Verification Anti-Doublon</h3>
            </div>
            <p className="text-xs text-neutral-700 leading-relaxed mb-5">
              {duplicateWarning}
            </p>
            <div className="flex justify-end gap-2 text-xs font-semibold">
              <button
                onClick={() => setDuplicateWarning(null)}
                className="px-4 py-2 border border-neutral-300 rounded hover:bg-neutral-100 text-neutral-700"
              >
                Annuler
              </button>
              <button
                onClick={() => handleNormalize(true)}
                className="px-4 py-2 bg-neutral-900 hover:bg-neutral-800 text-white rounded"
              >
                Confirmer et Emettre
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
