import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { ShieldCheck, Printer, AlertTriangle, FileText, CheckCircle2, AlertCircle } from 'lucide-react';

export default function App() {
  const [form, setForm] = useState({
    entity: 'AGL',
    reference: '',
    client_ifu: '',
    client_name: '',
    client_address: '',
    vessel_name: '',
    arrival_date: '',
    service_description: 'PRESTATIONS MARITIMES ET TRANSIT',
    amount_service: '',
    debours_description: 'DEBOURS DOUANE ET FRAIS PORTUAIRES AVANCES',
    amount_debours: '',
  });

  const [loading, setLoading] = useState(false);
  const [normalizedData, setNormalizedData] = useState(null);
  const [duplicateWarning, setDuplicateWarning] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    if (errorMessage) setErrorMessage(null);
  };

  const handleNormalize = async (force = false) => {
    setErrorMessage(null);
    setDuplicateWarning(null);

    const servNum = Number(form.amount_service) || 0;
    const debNum = Number(form.amount_debours) || 0;

    if (servNum <= 0 && debNum <= 0) {
      setErrorMessage('Veuillez renseigner un montant superieur a 0 pour la prestation HT ou pour les debours.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('http://127.0.0.1:3001/api/normalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          amount_service: servNum,
          amount_debours: debNum,
          has_tva: true,
          force
        })
      });

      const data = await res.json();

      if (data.requires_confirmation) {
        setDuplicateWarning(data.message);
      } else if (data.success) {
        setNormalizedData(data.data);
      } else {
        setErrorMessage(data.message || 'Erreur lors de la normalisation');
      }
    } catch (err) {
      setErrorMessage('Impossible de contacter le serveur Express local.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-100 font-sans">
      <div className="no-print w-[460px] bg-white border-r border-slate-200 flex flex-col h-full shadow-lg z-10">
        <div className="bg-slate-900 text-white p-5">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-emerald-400" />
            <h1 className="font-bold text-base tracking-wide">PORTAIL e-MECeF</h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">Normalisation AGL Benin et SOCOPAO</p>
        </div>

        <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-4 text-xs">
          
          {/* Bandeau d'erreur explicite */}
          {errorMessage && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 p-3 rounded flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-rose-600" />
              <div className="leading-tight font-medium">{errorMessage}</div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-slate-700 block mb-1">ENTITE</label>
              <select
                name="entity"
                value={form.entity}
                onChange={handleChange}
                className="w-full border border-slate-300 rounded px-3 py-2 bg-slate-50 focus:bg-white focus:ring-1 focus:ring-slate-900 outline-none font-semibold text-slate-900"
              >
                <option value="AGL">AGL BENIN</option>
                <option value="SOCOPAO">SOCOPAO</option>
              </select>
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-1">NUMERO FACTURE</label>
              <input
                type="text"
                name="reference"
                placeholder="Ex: 8461"
                value={form.reference}
                onChange={handleChange}
                className="w-full border border-slate-300 rounded px-3 py-2 outline-none focus:ring-1 focus:ring-slate-900"
              />
            </div>
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">IFU CLIENT (13 CHIFFRES)</label>
            <input
              type="text"
              name="client_ifu"
              maxLength={13}
              placeholder="0202430066359"
              value={form.client_ifu}
              onChange={handleChange}
              className="w-full border border-slate-300 rounded px-3 py-2 outline-none focus:ring-1 focus:ring-slate-900"
            />
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">RAISON SOCIALE / NOM CLIENT</label>
            <input
              type="text"
              name="client_name"
              placeholder="Nom complet du client"
              value={form.client_name}
              onChange={handleChange}
              className="w-full border border-slate-300 rounded px-3 py-2 outline-none focus:ring-1 focus:ring-slate-900"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-slate-700 block mb-1">NAVIRE</label>
              <input
                type="text"
                name="vessel_name"
                placeholder="MSC LAURA"
                value={form.vessel_name}
                onChange={handleChange}
                className="w-full border border-slate-300 rounded px-3 py-2 outline-none focus:ring-1 focus:ring-slate-900"
              />
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-1">DATE ARRIVEE</label>
              <input
                type="date"
                name="arrival_date"
                value={form.arrival_date}
                onChange={handleChange}
                className="w-full border border-slate-300 rounded px-3 py-2 outline-none focus:ring-1 focus:ring-slate-900"
              />
            </div>
          </div>

          {/* Ligne 1 : Prestation Taxable */}
          <div className="border-t border-slate-200 my-1 pt-3 space-y-2">
            <div>
              <label className="font-bold text-slate-700 block mb-1">LIBELLE ARTICLE TAXABLE (GRP B)</label>
              <input
                type="text"
                name="service_description"
                value={form.service_description}
                onChange={handleChange}
                className="w-full border border-slate-300 rounded px-3 py-2 outline-none text-slate-800 text-[11px]"
              />
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-1">MONTANT HT (TVA 18% APPLIQUEE)</label>
              <input
                type="number"
                name="amount_service"
                placeholder="0"
                value={form.amount_service}
                onChange={handleChange}
                className="w-full border border-slate-300 rounded px-3 py-2 outline-none font-bold text-slate-900"
              />
            </div>
          </div>

          {/* Ligne 2 : Débours */}
          <div className="border-t border-slate-200 my-1 pt-3 space-y-2">
            <div>
              <label className="font-bold text-slate-700 block mb-1">LIBELLE DEBOURS SANS TVA (GRP A)</label>
              <input
                type="text"
                name="debours_description"
                value={form.debours_description}
                onChange={handleChange}
                className="w-full border border-slate-300 rounded px-3 py-2 outline-none text-slate-800 text-[11px]"
              />
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-1">MONTANT DEBOURS (0% TVA)</label>
              <input
                type="number"
                name="amount_debours"
                placeholder="0"
                value={form.amount_debours}
                onChange={handleChange}
                className="w-full border border-slate-300 rounded px-3 py-2 outline-none text-slate-800 font-semibold"
              />
            </div>
          </div>

          <button
            onClick={() => handleNormalize(false)}
            disabled={loading || !form.reference || !form.client_name}
            className="mt-2 w-full bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white font-bold py-3 rounded shadow transition flex items-center justify-center gap-2"
          >
            {loading ? 'NORMALISATION EN COURS...' : 'VALIDER ET NORMALISER'}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-8 flex flex-col items-center justify-start">
        {normalizedData ? (
          <>
            <div className="no-print w-full max-w-md flex justify-between items-center mb-4">
              <span className="text-xs font-semibold text-emerald-700 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" /> Facture Certifiee DGI Benin
              </span>
              <button
                onClick={() => window.print()}
                className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-4 py-2 rounded flex items-center gap-1.5 shadow"
              >
                <Printer className="w-4 h-4" /> Imprimer / Telecharger PDF
              </button>
            </div>

            <div className="print-area w-full max-w-md bg-white p-8 rounded shadow-md border border-slate-200 font-mono text-[12px] text-slate-900 leading-relaxed">
              <div className="text-center font-bold text-[14px]">
                {normalizedData.entity === 'AGL' ? 'AGL BENIN' : 'SOCOPAO'}
              </div>
              <div className="text-center text-[11px] text-slate-600">Port de Cotonou, Benin</div>
              <div className="text-center text-[11px] mb-3">IFU : {normalizedData.emitter_ifu}</div>

              <div className="border-b border-dashed border-slate-400 my-2"></div>

              <div><strong>FACTURE N° :</strong> {normalizedData.reference}</div>
              <div><strong>CLIENT :</strong> {normalizedData.client_name}</div>
              <div><strong>IFU CLIENT :</strong> {normalizedData.client_ifu || 'NON RENSEIGNE'}</div>
              <div><strong>NAVIRE :</strong> {normalizedData.vessel_name || 'N/A'}</div>
              <div><strong>ESCALE :</strong> {normalizedData.arrival_date || 'N/A'}</div>

              <div className="border-b border-dashed border-slate-400 my-2"></div>

              <table className="w-full text-left my-2">
                <thead>
                  <tr className="border-b border-dashed border-slate-400">
                    <th className="py-1">DESCRIPTION</th>
                    <th className="text-right py-1">TOTAL</th>
                    <th className="text-right py-1">GRP</th>
                  </tr>
                </thead>
                <tbody>
                  {Number(normalizedData.amount_service) > 0 && (
                    <tr>
                      <td className="py-1">{normalizedData.service_description || 'PRESTATIONS MARITIMES ET TRANSIT'}</td>
                      <td className="text-right py-1">{Number(normalizedData.amount_service).toLocaleString('fr-FR')}</td>
                      <td className="text-right py-1">[B]</td>
                    </tr>
                  )}
                  {Number(normalizedData.amount_debours) > 0 && (
                    <tr>
                      <td className="py-1">{normalizedData.debours_description || 'DEBOURS DOUANE ET FRAIS PORTUAIRES'}</td>
                      <td className="text-right py-1">{Number(normalizedData.amount_debours).toLocaleString('fr-FR')}</td>
                      <td className="text-right py-1">[A]</td>
                    </tr>
                  )}
                </tbody>
              </table>

              <div className="border-b border-dashed border-slate-400 my-2"></div>

              <div className="space-y-1">
                <div className="flex justify-between">
                  <span>TOTAL HT :</span>
                  <span>{Number(normalizedData.amount_service).toLocaleString('fr-FR')} FCFA</span>
                </div>
                <div className="flex justify-between">
                  <span>TVA (18% - GRP B) :</span>
                  <span>{Number(normalizedData.amount_tva).toLocaleString('fr-FR')} FCFA</span>
                </div>
                <div className="flex justify-between">
                  <span>DEBOURS (GRP A) :</span>
                  <span>{Number(normalizedData.amount_debours).toLocaleString('fr-FR')} FCFA</span>
                </div>
                <div className="flex justify-between font-bold text-[13px] pt-1 border-t border-slate-300">
                  <span>NET A PAYER :</span>
                  <span>{Number(normalizedData.amount_total).toLocaleString('fr-FR')} FCFA</span>
                </div>
              </div>

              <div className="border-b border-dashed border-slate-400 my-3"></div>

              <div className="text-center font-bold text-[11px] mb-1">ELEMENTS FISCAUX e-MECeF / DGI</div>
              <div className="text-[10px] space-y-0.5">
                <div>NIM : {normalizedData.nim}</div>
                <div>COMPTEURS : {normalizedData.counters}</div>
                <div>CODE MECEF/DGI :</div>
                <div className="font-bold break-all text-[11px]">{normalizedData.code_mecef}</div>
                <div>DATE/HEURE : {normalizedData.date_time}</div>
              </div>

              <div className="flex justify-center my-4">
                <QRCodeSVG value={normalizedData.qr_code} size={135} level="M" />
              </div>

              <div className="text-center text-[10px] text-slate-500">
                Facture Normalisee Certifiee DGI Benin
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-3">
            <FileText className="w-16 h-16 stroke-1 text-slate-300" />
            <p className="text-sm">Renseignez les champs a gauche et cliquez sur Normaliser.</p>
          </div>
        )}
      </div>

      {duplicateWarning && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center gap-3 text-amber-600 mb-3">
              <AlertTriangle className="h-6 w-6" />
              <h3 className="font-bold text-base">Alerte Doublon et Idempotence</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed mb-5">
              {duplicateWarning}
            </p>
            <div className="flex justify-end gap-3 text-xs font-semibold">
              <button
                onClick={() => setDuplicateWarning(null)}
                className="px-4 py-2 border border-slate-300 rounded hover:bg-slate-100 text-slate-700"
              >
                Annuler
              </button>
              <button
                onClick={() => handleNormalize(true)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded shadow"
              >
                Confirmer et Forcer l'envoi
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
