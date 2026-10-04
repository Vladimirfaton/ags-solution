import { useEffect, useState } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, Search, Users } from 'lucide-react';
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
  const [detailsLoading, setDetailsLoading] = useState(false);
  const pageSize = 10;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const openFinancialDetails = (student) => {
    setDetailsLoading(true); setFinancialDetails(null); setError('');
    directionAPI.studentFinancialDetails(student.id).then(({ data }) => setFinancialDetails(data)).catch(() => setError('Impossible de charger la situation financière de cet élève.')).finally(() => setDetailsLoading(false));
  };
  const closeFinancialDetails = () => { setFinancialDetails(null); setDetailsLoading(false); };

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

  if (financialDetails || detailsLoading) return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <button type="button" onClick={closeFinancialDetails} className="mb-5 flex items-center gap-2 text-sm font-semibold text-emerald-700 hover:text-emerald-900"><ArrowLeft className="h-4 w-4" />Retour à la liste des élèves</button>
      {detailsLoading ? <p className="py-8 text-sm text-slate-500">Chargement de la situation financière...</p> : <>
        <div className="mb-5"><p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Détail de l’élève</p><h3 className="mt-2 text-xl font-semibold text-slate-900">{financialDetails.student.nom} {financialDetails.student.prenom}</h3><p className="mt-1 text-sm text-slate-500">{financialDetails.student.matricule} · {financialDetails.student.classe || 'Classe non renseignée'} · Année {financialDetails.student.annee}</p></div>
        <div className="overflow-x-auto rounded-xl border border-slate-200"><table className="w-full border-collapse text-left text-xs"><thead className="bg-slate-50"><tr className="border-b border-slate-200 font-semibold text-slate-500"><th className="px-3 py-2">Tranche</th><th className="px-3 py-2">Échéance</th><th className="px-3 py-2">Montant dû</th><th className="px-3 py-2">Payé</th><th className="px-3 py-2">Reste</th><th className="px-3 py-2">Statut</th></tr></thead><tbody className="divide-y divide-slate-100">{financialDetails.tranches.length ? financialDetails.tranches.map((tranche) => <tr key={tranche.id}><td className="px-3 py-2 font-medium text-slate-900">{tranche.libelle}</td><td className="px-3 py-2">{tranche.dateEcheance || '—'}</td><td className="px-3 py-2">{tranche.montantDu.toLocaleString('fr-FR')} FCFA</td><td className="px-3 py-2">{tranche.montantPaye.toLocaleString('fr-FR')} FCFA</td><td className="px-3 py-2 font-semibold">{tranche.reste.toLocaleString('fr-FR')} FCFA</td><td className="px-3 py-2"><span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${tranche.statut === 'solde' ? 'bg-emerald-100 text-emerald-700' : tranche.statut === 'partiel' ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'}`}>{tranche.statut === 'solde' ? 'Soldé' : tranche.statut === 'partiel' ? 'Partiel' : 'Impayé'}</span></td></tr>) : <tr><td colSpan="6" className="px-3 py-4 text-slate-500">Aucune tranche enregistrée pour cet élève.</td></tr>}</tbody></table></div>
      </>}
    </section>
  );

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

    </section>
  );
}
