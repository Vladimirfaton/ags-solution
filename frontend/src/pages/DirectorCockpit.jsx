import { Building2, CalendarDays, IdCard, MapPin, School, Users } from 'lucide-react';

const formatNumber = (value) => Number(value || 0).toLocaleString('fr-FR');
const classRank = (value = '') => {
  const level = value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  const found = level.match(/(?:^|\s)(6|5|4|3)(?:e|eme)?|(?:^|\s)(2nde|2nd|seconde|1ere|1re|tle|terminale)/);
  const key = found?.[1] || found?.[2] || '';

  return ({
    6: 1,
    5: 2,
    4: 3,
    3: 4,
    '2nde': 5,
    '2nd': 5,
    seconde: 5,
    '1ere': 6,
    '1re': 6,
    tle: 7,
    terminale: 7,
  })[key] || 99;
};

const sortClasses = (classes = []) => [...classes].sort((a, b) => {
  const rank = classRank(a.code_affichage) - classRank(b.code_affichage);
  return rank || a.code_affichage.localeCompare(b.code_affichage, 'fr', {
    numeric: true,
    sensitivity: 'base',
  });
});
export default function DirectorCockpit({ direction, yearForm, setYearForm, createYear, loadClass }) {
  const sites = direction?.sites || [];
  const classes = sortClasses(direction?.classes || []);
  const totalStudents = sites.reduce((sum, site) => sum + Number(site.students_count || 0), 0);
  const setYear = (key) => (event) => setYearForm({ ...yearForm, [key]: event.target.value });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Espace Direction</p>
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Direction</h2>
        <p className="text-sm text-slate-500">Une vue claire pour piloter l'établissement au quotidien.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric icon={<Building2 />} label="Établissement" value={direction?.etablissement?.nom || 'Non configuré'} tone="blue" />
        <Metric icon={<CalendarDays />} label="Année active" value={direction?.anneeActive?.libelle || 'À configurer'} tone="emerald" />
        <Metric icon={<School />} label="Classes actives" value={formatNumber(classes.length)} tone="amber" />
        <Metric icon={<Users />} label="Élèves inscrits" value={formatNumber(totalStudents)} tone="violet" />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-5">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <h3 className="font-semibold text-slate-900">Sites & filiales</h3>
                <p className="mt-1 text-xs text-slate-500">Répartition des activités par site.</p>
              </div>
              <span className="rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">{sites.length} site(s)</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {sites.length ? sites.map((site) => (
                <div key={site.id} className="rounded-xl border border-slate-200 p-4 transition hover:border-emerald-300 hover:bg-emerald-50/30">
                  <div className="flex items-start gap-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-slate-50 text-slate-500"><MapPin className="h-4 w-4" /></span>
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-slate-800" title={site.nom}>{site.nom}</p>
                      <p className="mt-1 text-xs text-slate-500">{site.est_principal ? 'Site principal' : 'Filiale'}{site.commune ? ` · ${site.commune}` : ''}</p>
                      <p className="mt-3 text-xs font-semibold text-emerald-700">{site.classes_count || 0} classe(s) · {formatNumber(site.students_count)} élève(s)</p>
                    </div>
                  </div>
                </div>
              )) : <EmptyState>Le site principal apparaîtra ici dès que l'établissement sera configuré.</EmptyState>}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-slate-900">Synthèse des classes</h3>
                <p className="mt-1 text-xs text-slate-500">Ouvrez une classe pour consulter ses élèves.</p>
              </div>
              <span className="text-xs font-semibold text-slate-400">{classes.length} active(s)</span>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {classes.length ? classes.map((item) => (
              <div key={item.id} className="rounded-xl border border-slate-200 bg-slate-50/40 p-3">
                <p className="font-semibold text-slate-800">{item.code_affichage}</p>
                <p className="mt-2 text-xs text-slate-500">{formatNumber(item.effectif)} élève(s)</p>
                <p className="mt-3 text-[11px] text-slate-400">{item.site_nom || 'Site principal'}</p>
              </div>
              )) : <EmptyState>Aucune classe active pour le moment.</EmptyState>}
            </div>
          </section>
        </div>

        <aside className="space-y-5">
  {!direction?.anneeActive ? (
    <section className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">Première étape</p>
      <h3 className="mt-2 font-semibold text-slate-900">Préparer l’année scolaire</h3>
      <p className="mt-2 text-xs leading-5 text-slate-500">
        Son activation permettra à la secrétaire de créer les classes et au comptable d’enregistrer les inscriptions.
      </p>

      <form onSubmit={createYear} className="mt-5 space-y-3">
        <Field label="Libellé" placeholder="2026-2027" value={yearForm.libelle} onChange={setYear('libelle')} required />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Début" type="month" value={yearForm.dateDebut} onChange={setYear('dateDebut')} required />
          <Field label="Fin" type="month" value={yearForm.dateFin} onChange={setYear('dateFin')} required />
        </div>
        <button className="w-full rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700">
          Activer l’année scolaire
        </button>
      </form>
    </section>
  ) : (
    <section className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">Année scolaire</p>
      <h3 className="mt-2 font-semibold text-slate-900">{direction.anneeActive.libelle}</h3>
      <p className="mt-2 text-xs leading-5 text-slate-500">
        L’année est active. Les opérations de classes et d’inscriptions peuvent se poursuivre.
      </p>
    </section>
  )}

  <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <div className="flex items-start gap-3">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-500">
        <IdCard className="h-4 w-4" />
      </span>
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">FVS Cartes</p>
        <h3 className="mt-2 font-semibold text-slate-900">Service non activé</h3>
        <p className="mt-2 text-xs leading-5 text-slate-500">
          Les classes et effectifs existants seront transmis au service sans double saisie lorsqu’il sera activé par FVS.
        </p>
      </div>
    </div>
  </section>

  <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <h3 className="font-semibold text-slate-900">État de l’établissement</h3>
    <div className="mt-4 space-y-3">
      {!direction?.anneeActive && (
        <Alert tone="amber" title="Année scolaire à configurer" text="Activez une année pour ouvrir les opérations de gestion." />
      )}
      {!sites.length && (
        <Alert tone="rose" title="Établissement incomplet" text="La configuration doit être vérifiée par l’administration FVS." />
      )}
      {direction?.anneeActive && sites.length > 0 && (
        <Alert tone="emerald" title="Établissement opérationnel" text="Les informations nécessaires au suivi sont disponibles." />
      )}
    </div>
  </section>
</aside>
      </div>
    </div>
  );
}

function Metric({ icon, label, value, tone }) {
  const tones = { blue: 'bg-blue-50 text-blue-600', emerald: 'bg-emerald-50 text-emerald-600', amber: 'bg-amber-50 text-amber-600', violet: 'bg-violet-50 text-violet-600' };
  return <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><span className={`grid h-9 w-9 place-items-center rounded-lg ${tones[tone]}`}>{icon}</span><p className="mt-4 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p><p className="mt-1 truncate text-sm font-semibold text-slate-900">{value}</p></div>;
}

function Field({ label, ...props }) { return <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}<input {...props} className="mt-2 block w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-normal normal-case tracking-normal text-slate-700 outline-none transition focus:border-emerald-500 focus:bg-white" /></label>; }
function EmptyState({ children }) { return <p className="col-span-full rounded-xl border border-dashed border-slate-200 p-5 text-sm text-slate-500">{children}</p>; }
function Alert({ tone, title, text }) { const styles = { amber: 'border-amber-400 bg-amber-50/50', rose: 'border-rose-400 bg-rose-50/50', emerald: 'border-emerald-400 bg-emerald-50/50' }; return <div className={`border-l-2 p-3 ${styles[tone]}`}><p className="text-xs font-semibold text-slate-800">{title}</p><p className="mt-1 text-xs leading-5 text-slate-500">{text}</p></div>; }
