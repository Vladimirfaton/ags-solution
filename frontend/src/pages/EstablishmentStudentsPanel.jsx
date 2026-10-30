import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Search, Users, X } from 'lucide-react';
import { directionAPI } from '../services/api';

export default function EstablishmentStudentsPanel({
  fetchStudents = directionAPI.listStudents,
  title = 'Liste des élèves',
  subtitle = "Tous les élèves de l'établissement pour l'année en cours.",
}) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [students, setStudents] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [financialDetails, setFinancialDetails] = useState(null);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [detailsError, setDetailsError] = useState('');
  const [detailsLoading, setDetailsLoading] = useState(false);
  const detailsRequestId = useRef(0);
  const pageSize = 10;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const openFinancialDetails = async (student) => {
    const requestId = ++detailsRequestId.current;
    setSelectedStudent(student);
    setDetailsLoading(true);
    setFinancialDetails(null);
    setDetailsError('');
    try {
      const { data } = await directionAPI.studentFinancialDetails(student.id);
      if (requestId === detailsRequestId.current) setFinancialDetails(data);
    } catch {
      if (requestId === detailsRequestId.current) setDetailsError('Impossible de charger la situation financière de cet élève.');
    } finally {
      if (requestId === detailsRequestId.current) setDetailsLoading(false);
    }
  };
  const closeFinancialDetails = () => {
    detailsRequestId.current += 1;
    setSelectedStudent(null);
    setFinancialDetails(null);
    setDetailsError('');
    setDetailsLoading(false);
  };

  useEffect(() => { setPage(1); }, [search]);
  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(true);
      fetchStudents(search, page)
        .then(({ data }) => { setStudents(data.students || []); setTotal(data.total || 0); setError(''); })
        .catch(() => setError('Impossible de charger la liste des élèves.'))
        .finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [search, page]);

  const trancheTotals = (financialDetails?.tranches || []).reduce((totals, tranche) => ({
    due: totals.due + Number(tranche.montantDu || 0),
    paid: totals.paid + Number(tranche.montantPaye || 0),
    remaining: totals.remaining + Number(tranche.reste || 0),
  }), { due: 0, paid: 0, remaining: 0 });

  /*
  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(true);
      fetchStudents(search, page)
        .then(({ data }) => { setStudents(data.students || []); setTotal(data.total || 0); setError(''); })
        .catch(() => setError('Impossible de charger la liste des élèves.'))
        .finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [search, page]);
  */

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="font-semibold text-slate-900">{title}</h3>
          <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
        </div>
        <span className="flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-600">
          <Users className="h-3.5 w-3.5" />{total} élève(s)
        </span>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Rechercher par nom, prénom, matricule ou classe"
          className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
      </div>

      {error && <p className="text-sm text-rose-600">{error}</p>}

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="h-10 animate-pulse rounded-lg bg-slate-100" />
          ))}
        </div>
      ) : students.length ? (
        <>
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full table-fixed border-collapse text-left text-xs">
              <colgroup>
                <col className="w-[22%]" /><col className="w-[20%]" /><col className="w-[28%]" /><col className="w-[20%]" /><col className="w-[10%]" />
              </colgroup>
              <thead className="bg-slate-50">
                <tr className="border-b border-slate-200 font-semibold text-slate-500">
                  <th className="px-3 py-2">Classe</th>
                  <th className="px-3 py-2">Matricule</th>
                  <th className="px-3 py-2">Nom</th>
                  <th className="px-3 py-2">Prénom(s)</th>
                  <th className="px-3 py-2">Sexe</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {students.map((student) => (
                  <tr key={student.id} onClick={() => openFinancialDetails(student)} className="cursor-pointer text-slate-700 hover:bg-emerald-50/50" title="Consulter la situation des paiements">
                    <td className="truncate px-3 py-2 font-medium text-slate-900">{student.code_affichage}</td>
                    <td className="truncate px-3 py-2">{student.matricule}</td>
                    <td className="truncate px-3 py-2 font-semibold text-slate-900">{student.nom}</td>
                    <td className="truncate px-3 py-2">{student.prenom}</td>
                    <td className="px-3 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${student.sexe === 'F' ? 'bg-pink-50 text-pink-700' : 'bg-blue-50 text-blue-700'}`}>
                        {student.sexe || '—'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
            <span>Page {page} sur {totalPages}</span>
            <div className="flex gap-2">
              <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">
                <ChevronLeft className="h-3.5 w-3.5" />Précédent
              </button>
              <button type="button" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">
                Suivant<ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </>
      ) : (
        <p className="rounded-xl border border-dashed border-slate-200 p-5 text-sm text-slate-500">
          {search.trim() ? 'Aucun élève ne correspond à la recherche.' : 'Aucun élève inscrit pour cette année.'}
        </p>
      )}

      {selectedStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Situation financière de l’élève">
          <section className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl sm:p-6">
            <div className="mb-5 flex flex-wrap items-start gap-3 border-b border-slate-100 pb-4">
              <div className="mr-auto min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-600">Situation des tranches</p>
                <h3 className="mt-1 break-words text-lg font-semibold text-slate-900">{financialDetails?.student?.nom || selectedStudent.nom} {financialDetails?.student?.prenom || selectedStudent.prenom}</h3>
                <p className="mt-1 text-xs text-slate-500">{financialDetails?.student?.matricule || selectedStudent.matricule || 'Sans matricule'} · {financialDetails?.student?.classe || selectedStudent.code_affichage || 'Classe non renseignée'}{financialDetails?.student?.annee ? ` · Année ${financialDetails.student.annee}` : ''}</p>
              </div>
              <button type="button" onClick={closeFinancialDetails} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"><X className="h-3.5 w-3.5" />Fermer</button>
            </div>

            {detailsLoading ? (
              <div className="space-y-3" aria-label="Chargement de la situation financière">
                <div className="h-16 animate-pulse rounded-xl bg-slate-100" />
                <div className="h-48 animate-pulse rounded-xl bg-slate-100" />
              </div>
            ) : detailsError ? (
              <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{detailsError}</p>
            ) : financialDetails && (
              <>
                <div className="mb-5 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3"><p className="text-xs text-slate-500">Montant total dû</p><p className="mt-1 font-semibold text-slate-900">{trancheTotals.due.toLocaleString('fr-FR')} FCFA</p></div>
                  <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-3"><p className="text-xs text-emerald-700">Total payé</p><p className="mt-1 font-semibold text-emerald-800">{trancheTotals.paid.toLocaleString('fr-FR')} FCFA</p></div>
                  <div className="rounded-xl border border-amber-100 bg-amber-50/60 p-3"><p className="text-xs text-amber-700">Reste à payer</p><p className="mt-1 font-semibold text-amber-800">{trancheTotals.remaining.toLocaleString('fr-FR')} FCFA</p></div>
                </div>
                <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                  <table className="w-full min-w-[760px] border-collapse text-left text-sm">
                    <thead className="border-b border-slate-200 bg-slate-50"><tr className="text-xs font-medium text-slate-500"><th className="px-4 py-3">Tranche</th><th className="px-4 py-3">Échéance</th><th className="px-4 py-3">Montant dû</th><th className="px-4 py-3">Payé</th><th className="px-4 py-3">Reste</th><th className="px-4 py-3">Statut</th></tr></thead>
                    <tbody className="divide-y divide-slate-100">
                      {financialDetails.tranches.length ? financialDetails.tranches.map((tranche) => (
                        <tr key={tranche.id} className="hover:bg-slate-50/60">
                          <td className="px-4 py-3 font-medium text-slate-900">{tranche.libelle}</td>
                          <td className="px-4 py-3 text-slate-600">{tranche.dateEcheance ? new Date(`${tranche.dateEcheance}T00:00:00`).toLocaleDateString('fr-FR') : '—'}</td>
                          <td className="px-4 py-3 text-slate-700">{Number(tranche.montantDu || 0).toLocaleString('fr-FR')} FCFA</td>
                          <td className="px-4 py-3 text-slate-700">{Number(tranche.montantPaye || 0).toLocaleString('fr-FR')} FCFA</td>
                          <td className="px-4 py-3 font-semibold text-slate-900">{Number(tranche.reste || 0).toLocaleString('fr-FR')} FCFA</td>
                          <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${tranche.statut === 'solde' ? 'bg-emerald-100 text-emerald-700' : tranche.statut === 'partiel' ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'}`}>{tranche.statut === 'solde' ? 'Soldé' : tranche.statut === 'partiel' ? 'Partiel' : 'Impayé'}</span></td>
                        </tr>
                      )) : <tr><td colSpan="6" className="px-4 py-6 text-center text-sm text-slate-500">Aucune tranche enregistrée pour cet élève.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </section>
        </div>
      )}

    </section>
  );
}
