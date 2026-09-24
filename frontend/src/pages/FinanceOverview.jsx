import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock, Download, Search, XCircle } from 'lucide-react';
import { comptabiliteAPI } from '../services/api';
import { generatePaymentReceiptPDF } from '../utils/paymentReceipt';

const money = (value) => `${Number(value || 0).toLocaleString('fr-FR')} F CFA`;

const statusBadge = {
  solde: { label: 'Soldé', className: 'bg-emerald-50 text-emerald-700' },
  partiel: { label: 'Partiel', className: 'bg-amber-50 text-amber-700' },
  impaye: { label: 'Impayé', className: 'bg-rose-50 text-rose-700' },
};

const normalize = (v) => v.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const detectStatus = (text) => {
  const t = normalize(text.trim());
  if (!t) return null;
  if (t.includes('impaye')) return 'impaye';
  if (t.includes('partiel')) return 'partiel';
  if (t.includes('solde') || t.includes('paye')) return 'solde';
  return null;
};
const downloadReceipt = async (paymentId) => {
  const { data } = await comptabiliteAPI.getPaymentReceipt(paymentId);
  await generatePaymentReceiptPDF(data);
};
export function HistoryPanel() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ payments: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const totalPages = Math.max(1, Math.ceil(data.total / 10));

  useEffect(() => { setPage(1); }, [search]);
  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(true);
      comptabiliteAPI.paymentHistory(search, page).then(({ data }) => setData(data)).finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [search, page]);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="font-semibold text-slate-900">Historique des paiements</h3>
      <div className="relative my-4">
        <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher un élève" className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
      </div>
      {loading ? (
        <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-10 animate-pulse rounded-lg bg-slate-100" />)}</div>
      ) : data.payments.length ? (
        <>
          <div className="divide-y divide-slate-100 text-sm">
            {data.payments.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-slate-800">{p.nom} {p.prenom} <span className="font-normal text-slate-400">· {p.classe}</span></p>
                  <p className="text-xs text-slate-500">{p.numeroRecu} · {new Date(p.date).toLocaleString('fr-FR')}</p>
                </div>
                <span className="shrink-0 font-semibold text-emerald-700">{money(p.montant)}</span>
                <button type="button" onClick={() => downloadReceipt(p.id)} className="shrink-0 text-xs font-semibold text-emerald-700 hover:text-emerald-800">
                  Télécharger reçu
                </button>
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
            <span>Page {page} sur {totalPages}</span>
            <div className="flex gap-2">
              <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="rounded-lg border border-slate-200 px-3 py-1.5 font-semibold text-slate-600 disabled:opacity-40">Précédent</button>
              <button type="button" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="rounded-lg border border-slate-200 px-3 py-1.5 font-semibold text-slate-600 disabled:opacity-40">Suivant</button>
            </div>
          </div>
        </>
      ) : <p className="rounded-xl border border-dashed border-slate-200 p-5 text-sm text-slate-500">Aucun paiement enregistré.</p>}
    </section>
  );
}
export function OverdueInstallmentsPanel() {
  const [search, setSearch] = useState('');
  const [data, setData] = useState({ classes: [], count: 0, totalReste: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(true);
      comptabiliteAPI.overdueInstallments(search).then(({ data }) => setData(data)).finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-rose-700">Échéances dépassées</h2>
        <p className="mt-1 text-sm text-slate-500">Tranches de scolarité dont la date limite est dépassée, non soldées.</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
          <p className="text-xs font-semibold uppercase text-rose-700">Tranches en retard</p>
          <p className="mt-1 text-xl font-semibold text-slate-900">{data.count}</p>
        </div>
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
          <p className="text-xs font-semibold uppercase text-rose-700">Montant restant dû</p>
          <p className="mt-1 text-xl font-semibold text-slate-900">{money(data.totalReste)}</p>
        </div>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher un élève, une classe, un matricule" className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
        </div>

        {loading ? (
          <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-10 animate-pulse rounded-lg bg-slate-100" />)}</div>
        ) : data.classes.length ? (
          <div className="space-y-6">
            {data.classes.map((group) => (
              <div key={group.classe}>
                <h3 className="mb-2 text-sm font-semibold text-slate-800">{group.classe}</h3>
                <div className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200">
                  {group.items.map((item) => (
                    <div key={item.obligationId} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-slate-800">{item.nom} {item.prenom} <span className="font-normal text-slate-400">· {item.matricule}</span></p>
                        <p className="mt-0.5 text-xs text-slate-500">{item.libelle} · échue le {new Date(item.dateEcheance).toLocaleDateString('fr-FR')}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="font-semibold text-rose-700">{money(item.reste)}</p>
                        <p className="text-xs text-slate-500">{item.statut === 'partiel' ? `Payé ${money(item.montantPaye)} / ${money(item.montantDu)}` : 'Rien payé'}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : <p className="rounded-xl border border-dashed border-slate-200 p-5 text-sm text-slate-500">Aucune échéance dépassée.</p>}
      </section>
    </div>
  );
}
export default function FinanceOverview() {
  const [search, setSearch] = useState('');
  const [statut, setStatut] = useState('tous');
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ students: [], total: 0, summary: { solde: 0, partiel: 0, impaye: 0 } });
  const [loading, setLoading] = useState(true);
  const pageSize = 10;
  const totalPages = Math.max(1, Math.ceil(data.total / pageSize));

  const detected = useMemo(() => detectStatus(search), [search]);
  const effectiveStatut = detected || statut;
  const effectiveSearch = detected ? '' : search;

  useEffect(() => { setPage(1); }, [search, statut]);
  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(true);
      comptabiliteAPI.paymentStatus({ recherche: effectiveSearch, statut: effectiveStatut, page, pageSize })
        .then(({ data }) => setData(data))
        .finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [effectiveSearch, effectiveStatut, page]);

  const downloadCsv = async () => {
    const response = await comptabiliteAPI.exportPaymentStatus({ recherche: effectiveSearch, statut: effectiveStatut });
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'statut-paiements.csv';
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-emerald-700">Statistiques de scolarité</h2>
        <p className="mt-1 text-sm text-slate-500">Suivi des élèves soldés, en paiement partiel ou impayés.</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <button type="button" onClick={() => setStatut(statut === 'solde' ? 'tous' : 'solde')} className={`rounded-2xl border p-4 text-left transition ${effectiveStatut === 'solde' ? 'border-emerald-400 bg-emerald-50' : 'border-slate-200 bg-white hover:border-emerald-200'}`}>
          <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          <p className="mt-3 text-xs font-semibold uppercase text-slate-400">Soldé</p>
          <p className="mt-1 text-xl font-semibold text-slate-900">{data.summary.solde}</p>
        </button>
        <button type="button" onClick={() => setStatut(statut === 'partiel' ? 'tous' : 'partiel')} className={`rounded-2xl border p-4 text-left transition ${effectiveStatut === 'partiel' ? 'border-amber-400 bg-amber-50' : 'border-slate-200 bg-white hover:border-amber-200'}`}>
          <Clock className="h-5 w-5 text-amber-600" />
          <p className="mt-3 text-xs font-semibold uppercase text-slate-400">Partiel</p>
          <p className="mt-1 text-xl font-semibold text-slate-900">{data.summary.partiel}</p>
        </button>
        <button type="button" onClick={() => setStatut(statut === 'impaye' ? 'tous' : 'impaye')} className={`rounded-2xl border p-4 text-left transition ${effectiveStatut === 'impaye' ? 'border-rose-400 bg-rose-50' : 'border-slate-200 bg-white hover:border-rose-200'}`}>
          <XCircle className="h-5 w-5 text-rose-600" />
          <p className="mt-3 text-xs font-semibold uppercase text-slate-400">Impayé</p>
          <p className="mt-1 text-xl font-semibold text-slate-900">{data.summary.impaye}</p>
        </button>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher par nom, prénom, matricule, classe ou statut (impayé, partiel, soldé)" className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>
          <button type="button" onClick={downloadCsv} className="flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800">
            <Download className="h-3.5 w-3.5" />Télécharger la liste
          </button>
        </div>

        {loading ? (
          <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-10 animate-pulse rounded-lg bg-slate-100" />)}</div>
        ) : data.students.length ? (
          <>
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full table-fixed border-collapse text-left text-xs">
                <colgroup><col className="w-32" /><col className="w-32" /><col className="w-32" /><col className="w-28" /><col className="w-28" /><col className="w-28" /><col /></colgroup>
                <thead className="bg-slate-50">
                  <tr className="border-b border-slate-200 font-semibold text-slate-500">
                    <th className="px-3 py-2">Classe</th><th className="px-3 py-2">Nom</th><th className="px-3 py-2">Prénom</th>
                    <th className="px-3 py-2">Dû</th><th className="px-3 py-2">Payé</th><th className="px-3 py-2">Reste</th><th className="px-3 py-2">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.students.map((s) => (
                    <tr key={`${s.matricule}`} className="text-slate-700 hover:bg-slate-50/70">
                      <td className="truncate px-3 py-2 font-medium text-slate-900">{s.classe}</td>
                      <td className="truncate px-3 py-2 font-semibold text-slate-900">{s.nom}</td>
                      <td className="truncate px-3 py-2">{s.prenom}</td>
                      <td className="px-3 py-2">{money(s.totalDu)}</td>
                      <td className="px-3 py-2">{money(s.totalPaye)}</td>
                      <td className="px-3 py-2 font-semibold">{money(s.reste)}</td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap items-center gap-1">
                          <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusBadge[s.statut].className}`}>{statusBadge[s.statut].label}</span>
                          {s.fraisImpayes > 0 && <span title="Frais généraux obligatoires non soldés : à régler en caisse avant les tranches" className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">Frais gén. impayés</span>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
              <span>Page {page} sur {totalPages}</span>
              <div className="flex gap-2">
                <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="rounded-lg border border-slate-200 px-3 py-1.5 font-semibold text-slate-600 disabled:opacity-40">Précédent</button>
                <button type="button" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="rounded-lg border border-slate-200 px-3 py-1.5 font-semibold text-slate-600 disabled:opacity-40">Suivant</button>
              </div>
            </div>
          </>
        ) : <p className="rounded-xl border border-dashed border-slate-200 p-5 text-sm text-slate-500">Aucun élève ne correspond à ce filtre.</p>}
      </section>
    </div>
  );
}