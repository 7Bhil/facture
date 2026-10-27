import { QRCodeSVG } from 'qrcode.react';

const INVOICE_TYPE_LABELS = {
  FV: 'FACTURE DE VENTE',
  FA: "FACTURE D'AVOIR",
  EV: "FACTURE DE VENTE A L'EXPORTATION",
  EA: "FACTURE D'AVOIR A L'EXPORTATION"
};

function formatNumber(n) {
  return Math.round(Number(n) || 0).toLocaleString('fr-FR').replace(/\s/g, '.');
}

export default function InvoiceSheetA4({ invoice }) {
  if (!invoice) return null;

  const isTest = (invoice.code_mecef || '').startsWith('TEST');
  const typeLabel = INVOICE_TYPE_LABELS[invoice.invoice_type] || 'FACTURE DE VENTE';
  const counterNum = (invoice.counters || '1/1').split('/')[0];
  const invoiceNumber = `${invoice.nim || 'TS01020135'}-${counterNum}`;
  const dateOnly = (invoice.date_time || '').split(' ')[0] || invoice.date_time;

  // Construction des lignes de ventilation fiscale officielles
  const taxRows = [];
  if (invoice.taa > 0) {
    taxRows.push({
      label: 'A - EXONERE / DEBOURS (0%)',
      total: invoice.taa,
      imposable: invoice.taa,
      impot: 0
    });
  }
  if (invoice.tab > 0) {
    taxRows.push({
      label: 'B - TAXABLE (18%)',
      total: invoice.tab,
      imposable: invoice.hab,
      impot: invoice.vab
    });
  }
  if (invoice.tac > 0) {
    taxRows.push({
      label: 'C - EXPORTATION (0%)',
      total: invoice.tac,
      imposable: invoice.tac,
      impot: 0
    });
  }
  if (invoice.tad > 0) {
    taxRows.push({
      label: "D - EXCEPTION (18%)",
      total: invoice.tad,
      imposable: invoice.had,
      impot: invoice.vad
    });
  }
  if (invoice.tae > 0) {
    taxRows.push({
      label: 'E - REGIME TPS (0%)',
      total: invoice.tae,
      imposable: invoice.tae,
      impot: 0
    });
  }
  if (invoice.taf > 0) {
    taxRows.push({
      label: 'F - RESERVE (0%)',
      total: invoice.taf,
      imposable: invoice.taf,
      impot: 0
    });
  }
  if (invoice.aib_amount > 0) {
    taxRows.push({
      label: `AIB (${invoice.aib_type === 'B' ? '5%' : '1%'})`,
      total: invoice.aib_amount,
      imposable: '-',
      impot: invoice.aib_amount
    });
  }

  return (
    <div className="print-area bg-white w-full max-w-[794px] border border-neutral-300 shadow-sm p-8 text-neutral-900 text-[12px] leading-snug font-sans">
      
      {/* Bandeau TEST FACTURE conforme SyGMEF */}
      {isTest && (
        <div className="border-2 border-neutral-800 text-neutral-900 text-center font-bold py-1.5 mb-3 tracking-wider text-[11px]">
          ----- TEST FACTURE !!!!! -----
        </div>
      )}

      {/* En-tete Vendeur & Titre Facture */}
      <div className="flex justify-between items-start mb-5">
        <div>
          <div className="text-[17px] font-bold tracking-wide">
            {invoice.entity === 'SOCOPAO' ? 'SOCOPAO BENIN' : 'AGL BENIN'}
          </div>
          <div className="text-[12px] text-neutral-700 mt-0.5">
            IFU : {invoice.emitter_ifu || '0202430066359'}
          </div>
          <div className="text-[11px] text-neutral-600">
            Dossier Réf. : <span className="font-semibold text-neutral-900">{invoice.dossier_ref}</span>
          </div>
        </div>

        <div className="text-right">
          <div className="text-[15px] font-bold uppercase">
            {typeLabel}
          </div>
          <div className="text-[12px] mt-0.5">
            Facture # <span className="font-semibold">{invoiceNumber}</span>
          </div>
          <div className="text-[12px]">
            Date : {dateOnly}
          </div>
          <div className="text-[12px]">
            Vendeur : SERVICE FACTURATION {invoice.entity}
          </div>
          {(invoice.invoice_type === 'FA' || invoice.invoice_type === 'EA') && invoice.original_mecef_code && (
            <div className="text-[11px] font-semibold mt-0.5">
              Réf. de fact. orig. : {invoice.original_mecef_code}
            </div>
          )}
        </div>
      </div>

      {/* Double encadre Point de Vente & Client */}
      <div className="grid grid-cols-2 gap-4 mb-5">
        <div className="border border-neutral-400 p-3 text-[11px] space-y-1">
          <div className="grid grid-cols-3">
            <span className="italic text-neutral-600">Adresse</span>
            <span className="col-span-2">{invoice.emitter_address || 'Port de Cotonou, Benin'}</span>
          </div>
          <div className="grid grid-cols-3">
            <span className="italic text-neutral-600">Contact</span>
            <span className="col-span-2">{invoice.emitter_contact || '0144242964'}</span>
          </div>
          <div className="grid grid-cols-3">
            <span className="italic text-neutral-600">e-MCF</span>
            <span className="col-span-2 font-semibold">{invoice.nim}</span>
          </div>
        </div>

        <div className="border border-neutral-400 text-[11px]">
          <div className="bg-neutral-700 text-white font-bold px-3 py-1 text-[11px]">
            CLIENT
          </div>
          <div className="p-2.5 space-y-1">
            <div className="grid grid-cols-3">
              <span className="italic text-neutral-600">Nom</span>
              <span className="col-span-2 font-semibold">{invoice.client_name}</span>
            </div>
            <div className="grid grid-cols-3">
              <span className="italic text-neutral-600">IFU</span>
              <span className="col-span-2">{invoice.client_ifu || '-'}</span>
            </div>
            <div className="grid grid-cols-3">
              <span className="italic text-neutral-600">Adresse</span>
              <span className="col-span-2">{invoice.client_address || '-'}</span>
            </div>
            <div className="grid grid-cols-3">
              <span className="italic text-neutral-600">Contact</span>
              <span className="col-span-2">{invoice.client_contact || '-'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Mentions Maritimes / Description supplementaire */}
      {(invoice.vessel_name || invoice.arrival_date || invoice.bl_number) && (
        <div className="border border-neutral-300 bg-neutral-50 px-3 py-2 mb-5 text-[11px] flex flex-wrap justify-between gap-2">
          <div>
            <span className="font-semibold text-neutral-700">Navire : </span>
            <span>{invoice.vessel_name || 'N/A'}</span>
          </div>
          <div>
            <span className="font-semibold text-neutral-700">Date d'arrivée : </span>
            <span>{invoice.arrival_date || 'N/A'}</span>
          </div>
          <div>
            <span className="font-semibold text-neutral-700">N° BL / Connaissement : </span>
            <span>{invoice.bl_number || 'N/A'}</span>
          </div>
        </div>
      )}

      {/* Tableau des articles conforme SyGMEF */}
      <table className="w-full border-collapse border border-neutral-500 mb-5 text-[11px]">
        <thead>
          <tr className="bg-neutral-100 border-b border-neutral-500">
            <th className="border-r border-neutral-400 px-2 py-1.5 text-center w-10">#</th>
            <th className="border-r border-neutral-400 px-3 py-1.5 text-left">Nom</th>
            <th className="border-r border-neutral-400 px-3 py-1.5 text-right w-28">Prix unitaire</th>
            <th className="border-r border-neutral-400 px-3 py-1.5 text-right w-20">Quantité</th>
            <th className="px-3 py-1.5 text-right w-36">Montant T.T.C.</th>
          </tr>
        </thead>
        <tbody>
          {(invoice.items || []).map((item, idx) => (
            <tr key={idx} className="border-b border-neutral-300">
              <td className="border-r border-neutral-300 px-2 py-1.5 text-center">{idx + 1}</td>
              <td className="border-r border-neutral-300 px-3 py-1.5">{item.name}</td>
              <td className="border-r border-neutral-300 px-3 py-1.5 text-right">{formatNumber(item.unit_price_ttc)}</td>
              <td className="border-r border-neutral-300 px-3 py-1.5 text-right">{item.quantity}</td>
              <td className="px-3 py-1.5 text-right font-medium">
                {formatNumber(item.line_total_ttc)} [{item.tax_group}]
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Ventilation des impots et Total General */}
      <div className="flex justify-between items-start gap-6 mb-5">
        <div className="flex-1">
          <div className="text-[10px] italic text-neutral-600 mb-1">
            --- VENTILATION DES IMPOTS ---
          </div>
          <table className="w-full border-collapse border border-neutral-400 text-[11px]">
            <thead>
              <tr className="bg-neutral-100 border-b border-neutral-400">
                <th className="border-r border-neutral-300 px-2 py-1 text-left">Groupe</th>
                <th className="border-r border-neutral-300 px-2 py-1 text-right">Total</th>
                <th className="border-r border-neutral-300 px-2 py-1 text-right">Imposable</th>
                <th className="px-2 py-1 text-right">Impôt</th>
              </tr>
            </thead>
            <tbody>
              {taxRows.map((tr, i) => (
                <tr key={i} className="border-b border-neutral-300">
                  <td className="border-r border-neutral-300 px-2 py-1">{tr.label}</td>
                  <td className="border-r border-neutral-300 px-2 py-1 text-right">{formatNumber(tr.total)}</td>
                  <td className="border-r border-neutral-300 px-2 py-1 text-right">
                    {tr.imposable === '-' ? '-' : formatNumber(tr.imposable)}
                  </td>
                  <td className="px-2 py-1 text-right">{formatNumber(tr.impot)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="border-t-2 border-b-2 border-neutral-900 py-2 px-4 min-w-[200px] text-right mt-4">
          <span className="text-[16px] font-bold tracking-wide">
            Total : {formatNumber(invoice.total_ttc)} FCFA
          </span>
        </div>
      </div>

      {/* Repartition des paiements */}
      <div className="mb-5">
        <div className="text-[10px] italic text-neutral-600 mb-1">
          --- REPARTITION DES PAIEMENTS ---
        </div>
        <table className="w-full border-collapse border border-neutral-400 text-[11px]">
          <thead>
            <tr className="bg-neutral-100 border-b border-neutral-400">
              <th className="border-r border-neutral-300 px-3 py-1 text-left">Type de paiement</th>
              <th className="px-3 py-1 text-right w-40">Payé</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border-r border-neutral-300 px-3 py-1 font-medium">{invoice.payment_type || 'VIREMENT'}</td>
              <td className="px-3 py-1 text-right font-semibold">{formatNumber(invoice.total_ttc)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Elements de securite de la facture normalisee */}
      <div>
        <div className="text-[10px] italic text-neutral-600 mb-1">
          --- ELEMENTS DE SECURITE DE LA FACTURE NORMALISEE ---
        </div>
        <div className="border border-neutral-500 p-4">
          {isTest && (
            <div className="border border-neutral-700 text-neutral-900 text-center font-bold py-1 mb-3 text-[11px]">
              ----- TEST FACTURE !!!!! -----
            </div>
          )}

          <div className="flex items-center justify-between gap-6 px-4">
            <div className="flex-shrink-0">
              <QRCodeSVG value={invoice.qr_code || ''} size={115} level="M" />
            </div>

            <div className="flex-1 max-w-[340px] text-[11px] space-y-1">
              <div className="text-center mb-2">
                <div className="text-neutral-600 text-[10px]">Code MECeF/DGI</div>
                <div className="font-bold text-[12px] tracking-wider font-mono">
                  {invoice.code_mecef}
                </div>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-600">MECeF NIM :</span>
                <span className="font-bold font-mono">{invoice.nim}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-600">MECeF Compteurs :</span>
                <span className="font-bold font-mono">{invoice.counters}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-600">MECeF Heure :</span>
                <span className="font-bold font-mono">{invoice.date_time}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {invoice.custom_message && (
        <div className="mt-4 text-center text-[11px] italic text-neutral-600 border-t border-neutral-200 pt-2">
          {invoice.custom_message}
        </div>
      )}
    </div>
  );
}
