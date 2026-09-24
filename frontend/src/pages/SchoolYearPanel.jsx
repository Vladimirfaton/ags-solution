import { useEffect, useState } from 'react';
import { Archive, ChevronLeft } from 'lucide-react';
import { directionAPI } from '../services/api';

const formatMonth = (value) => (value ? new Date(value).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }) : '');
const nextLabel = (label = '') => {
  const found = label.match(/^(\d{4})-(\d{4})$/);
  return found ? `${Number(found[1]) + 1}-${Number(found[2]) + 1}` : '';
};

function Field({ label, ...props }) {
  return <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}<input {...props} className="mt-2 block w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-normal normal-case tracking-normal text-slate-700 outline-none transition focus:border-emerald-500 focus:bg-white" /></label>;
}

export default function SchoolYearPanel({ direction, schoolYears = [], yearForm, setYearForm, createYear, createNextYear, activateYear, closeYear }) {
  const active = direction?.anneeActive;
  const draft = schoolYears.find((year) => year.statut === 'brouillon');
  const reference = active || schoolYears[0];
  const isFirst = !active && !schoolYears.length;
  const [draftCount, setDraftCount] = useState(null);
  const setYear = (key) => (event) => setYearForm({ ...yearForm, [key]: event.target.value });

  useEffect(() => {
    if (!draft) { setDraftCount(null); return; }
    directionAPI.listYearClasses(draft.id).then(({ data }) => setDraftCount(data.classes?.length ?? 0)).catch(() => setDraftCount(null));
  }, [draft?.id]);

  const confirmClose = () => {
    if (window.confirm(`Clôturer l'année ${active.libelle} ? Classes, inscriptions et paiements seront bloqués tant qu'une nouvelle année n'est pas activée.`)) closeYear(active.id);
  };
  const confirmActivate = () => {
    const message = active
      ? `Activer ${draft.libelle} ? L'année ${active.libelle} sera clôturée et archivée.`
      : `Activer ${draft.libelle} ?`;
    if (window.confirm(message)) activateYear(draft.id);
  };

  if (isFirst) {
    return (
      <section className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">Première étape</p>
        <h3 className="mt-2 font-semibold text-slate-900">Préparer l’année scolaire</h3>
        <p className="mt-2 text-xs leading-5 text-slate-500">Son activation permettra à la secrétaire de créer les classes et au comptable d’enregistrer les inscriptions.</p>
        <form onSubmit={createYear} className="mt-5 space-y-3">
          <Field label="Libellé" placeholder="2026-2027" value={yearForm.libelle} onChange={setYear('libelle')} required />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Début" type="month" value={yearForm.dateDebut} onChange={setYear('dateDebut')} required />
            <Field label="Fin" type="month" value={yearForm.dateFin} onChange={setYear('dateFin')} required />
          </div>
          <button className="w-full rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700">Activer l’année scolaire</button>
        </form>
      </section>
    );
  }

  return (
    <>
      {active ? (
        <section className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">Année scolaire active</p>
          <h3 className="mt-2 font-semibold text-slate-900">{active.libelle}</h3>
          <p className="mt-2 text-xs leading-5 text-slate-500">{formatMonth(active.date_debut)} → {formatMonth(active.date_fin)}</p>
          <button type="button" onClick={confirmClose} className="mt-4 w-full rounded-lg border border-rose-200 px-4 py-2.5 text-sm font-semibold text-rose-700 transition hover:bg-rose-50">Clôturer l’année</button>
        </section>
      ) : (
        <section className="rounded-2xl border border-amber-200 bg-amber-50/50 p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-700">Aucune année active</p>
          <p className="mt-2 text-xs leading-5 text-slate-600">Les opérations de gestion sont suspendues jusqu’à l’activation d’une nouvelle année.</p>
        </section>
      )}

      {draft ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Année en préparation</p>
          <h3 className="mt-2 font-semibold text-slate-900">{draft.libelle}</h3>
          <p className="mt-2 text-xs leading-5 text-slate-500">
            {formatMonth(draft.date_debut)} → {formatMonth(draft.date_fin)}
            {draftCount !== null ? ` · ${draftCount} classe(s) copiée(s)` : ''}
          </p>
          <button type="button" onClick={confirmActivate} className="mt-4 w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700">Activer cette année</button>
        </section>
      ) : (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="font-semibold text-slate-900">Préparer l’année suivante</h3>
          <p className="mt-2 text-xs leading-5 text-slate-500">Classes, frais généraux, tarifs et tranches de l’année précédente sont copiés automatiquement.</p>
          <form onSubmit={createNextYear} className="mt-4 space-y-3">
            <Field label="Libellé" placeholder={reference ? nextLabel(reference.libelle) : '2026-2027'} value={yearForm.libelle} onChange={setYear('libelle')} required />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Début" type="month" value={yearForm.dateDebut} onChange={setYear('dateDebut')} required />
              <Field label="Fin" type="month" value={yearForm.dateFin} onChange={setYear('dateFin')} required />
            </div>
            <button className="w-full rounded-lg bg-slate-800 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-900">Créer le brouillon</button>
          </form>
        </section>
      )}
    </>
  );
}

export function YearArchives({ schoolYears = [] }) {
  const archived = schoolYears.filter((year) => year.statut === 'archivee');
  const [openYear, setOpenYear] = useState(null);
  const [classes, setClasses] = useState([]);
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState('');

  if (!archived.length) return null;

  const openArchive = async (year) => {
    setError(''); setDetail(null);
    try {
      const { data } = await directionAPI.listYearClasses(year.id);
      setClasses(data.classes || []);
      setOpenYear(year);
    } catch { setError('Impossible de charger cette archive.'); }
  };
  const openClass = async (classId) => {
    setError('');
    try { setDetail((await directionAPI.listArchivedClassStudents(classId)).data); }
    catch { setError('Impossible de charger cette classe.'); }
  };
  const back = () => { if (detail) setDetail(null); else setOpenYear(null); };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <h3 className="font-semibold text-slate-900">Archives</h3>
          <p className="mt-1 text-xs text-slate-500">Années clôturées, consultables en lecture seule.</p>
        </div>
        {openYear && <button type="button" onClick={back} className="flex items-center gap-1 text-sm font-semibold text-emerald-700"><ChevronLeft className="h-4 w-4" />Retour</button>}
      </div>
      {error && <p className="mb-3 text-sm text-rose-600">{error}</p>}

      {!openYear && (
        <div className="grid gap-3 sm:grid-cols-2">
          {archived.map((year) => (
            <button key={year.id} type="button" onClick={() => openArchive(year)} className="flex items-center gap-3 rounded-xl border border-slate-200 p-4 text-left transition hover:border-emerald-300 hover:bg-emerald-50/30">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-slate-50 text-slate-500"><Archive className="h-4 w-4" /></span>
              <span><span className="block font-semibold text-slate-800">{year.libelle}</span><span className="block text-xs text-slate-500">{formatMonth(year.date_debut)} → {formatMonth(year.date_fin)}</span></span>
            </button>
          ))}
        </div>
      )}

      {openYear && !detail && (
        <>
          <p className="mb-3 text-sm font-semibold text-slate-700">Année {openYear.libelle}</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {classes.length ? classes.map((item) => (
              <button key={item.id} type="button" onClick={() => openClass(item.id)} className="rounded-xl border border-slate-200 bg-slate-50/40 p-3 text-left transition hover:border-emerald-300">
                <p className="font-semibold text-slate-800">{item.code_affichage}</p>
                <p className="mt-2 text-xs text-slate-500">{item.effectif} élève(s)</p>
                <p className="mt-3 text-[11px] text-slate-400">{item.site_nom}</p>
              </button>
            )) : <p className="col-span-full text-sm text-slate-500">Aucune classe dans cette archive.</p>}
          </div>
        </>
      )}

      {detail && (
        <>
          <p className="mb-3 text-sm font-semibold text-slate-700">{detail.classInfo.code_affichage} · {openYear.libelle}</p>
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full border-collapse text-left text-xs">
              <thead className="bg-slate-50">
                <tr className="border-b border-slate-200 font-semibold text-slate-500">
                  <th className="px-3 py-2">Matricule</th><th className="px-3 py-2">Nom</th><th className="px-3 py-2">Prénom(s)</th><th className="px-3 py-2">Sexe</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {detail.students.length ? detail.students.map((student) => (
                  <tr key={student.id} className="text-slate-700">
                    <td className="px-3 py-2 font-medium text-slate-900">{student.matricule}</td>
                    <td className="px-3 py-2 font-semibold text-slate-900">{student.nom}</td>
                    <td className="px-3 py-2">{student.prenom}</td>
                    <td className="px-3 py-2">{student.sexe || '—'}</td>
                  </tr>
                )) : <tr><td colSpan="4" className="px-3 py-4 text-slate-500">Aucun élève dans cette classe.</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}