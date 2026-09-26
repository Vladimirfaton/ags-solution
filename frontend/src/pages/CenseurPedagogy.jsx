import { useEffect, useState } from 'react';
import { BookOpen, Check, Pencil, Plus, UserPlus, UsersRound } from 'lucide-react';
import { censeurAPI } from '../services/api';

const blankProfessor = { nom: '', prenom: '', sexe: '', telephone: '', email: '' };
const blankSubject = { nom: '', code: '' };

export default function CenseurPedagogy({ establishmentType = 'college' }) {
  const [professors, setProfessors] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [classes, setClasses] = useState([]);
  const [error, setError] = useState('');
  const [professorForm, setProfessorForm] = useState(blankProfessor);
  const [subjectForm, setSubjectForm] = useState(blankSubject);
  const [editingProfessor, setEditingProfessor] = useState(null);
  const [editingSubject, setEditingSubject] = useState(null);
  const [selectedProfessor, setSelectedProfessor] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [assignment, setAssignment] = useState({ professorId: '', annualClassId: '', matiereId: '' });
  const refresh = async () => {
    try {
      const [professorsData, subjectsData, classesData] = await Promise.all([censeurAPI.listProfessors(), censeurAPI.listSubjects(), censeurAPI.listClasses()]);
      setProfessors(professorsData.data.professeurs);
      setSubjects(subjectsData.data.matieres);
      setClasses(classesData.data.classes);
    } catch (err) {
      setError(err.response?.data?.error || 'Impossible de charger l’équipe pédagogique.');
    }
  };
  useEffect(() => { refresh(); }, []);
  const run = async (work) => { setError(''); try { await work(); await refresh(); } catch (err) { setError(err.response?.data?.error || 'Opération impossible.'); } };
  const createSubject = (payload) => run(() => censeurAPI.createSubject(payload));
  const updateSubject = (id, payload) => run(() => censeurAPI.updateSubject(id, payload));
  const createProfessor = (payload) => run(() => censeurAPI.createProfessor(payload));
  const updateProfessor = (id, payload) => run(() => censeurAPI.updateProfessor(id, payload));
  const assignProfessor = (id, payload) => run(() => censeurAPI.assignProfessor(id, payload));
  const showAssignments = async (professor) => {
    setSelectedProfessor(professor);
    try { setAssignments((await censeurAPI.listAssignments(professor.id)).data.affectations); } catch (err) { setError(err.response?.data?.error || 'Impossible de charger les affectations.'); }
  };
  const endAssignment = (id) => run(() => censeurAPI.endAssignment(id));
  const setProfessor = (key) => (event) => setProfessorForm({ ...professorForm, [key]: event.target.value });
  const setSubject = (key) => (event) => setSubjectForm({ ...subjectForm, [key]: event.target.value });

  const submitProfessor = async (event) => {
    event.preventDefault();
    if (editingProfessor) {
      await updateProfessor(editingProfessor.id, { ...editingProfessor, actif: editingProfessor.actif });
      setEditingProfessor(null);
      return;
    }
    await createProfessor(professorForm);
    setProfessorForm(blankProfessor);
  };

  const submitSubject = async (event) => {
    event.preventDefault();
    if (editingSubject) {
      await updateSubject(editingSubject.id, editingSubject);
      setEditingSubject(null);
      return;
    }
    await createSubject(subjectForm);
    setSubjectForm(blankSubject);
  };

  const submitAssignment = async (event) => {
    event.preventDefault();
    await assignProfessor(assignment.professorId, { annualClassId: assignment.annualClassId, matiereId: assignment.matiereId || null });
    setAssignment({ ...assignment, annualClassId: '', matiereId: '' });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-violet-700">Équipe pédagogique</h2>
        <p className="mt-1 text-sm text-slate-500">Structurez les matières, les professeurs et leurs affectations par classe.</p>
      </div>
      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div><h3 className="font-semibold text-slate-900">Professeurs</h3><p className="mt-1 text-xs text-slate-500">{professors.length} membre(s) référencé(s)</p></div>
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-violet-50 text-violet-600"><UsersRound className="h-4 w-4" /></span>
          </div>
          <form onSubmit={submitProfessor} className="grid gap-3 border-b border-slate-100 pb-5 sm:grid-cols-2">
            <Field label="Nom" value={editingProfessor?.nom ?? professorForm.nom} onChange={editingProfessor ? (event) => setEditingProfessor({ ...editingProfessor, nom: event.target.value }) : setProfessor('nom')} required />
            <Field label="Prénom" value={editingProfessor?.prenom ?? professorForm.prenom} onChange={editingProfessor ? (event) => setEditingProfessor({ ...editingProfessor, prenom: event.target.value }) : setProfessor('prenom')} required />
            <Field label="Téléphone" value={editingProfessor?.telephone ?? professorForm.telephone} onChange={editingProfessor ? (event) => setEditingProfessor({ ...editingProfessor, telephone: event.target.value }) : setProfessor('telephone')} />
            <Field label="Email" type="email" value={editingProfessor?.email ?? professorForm.email} onChange={editingProfessor ? (event) => setEditingProfessor({ ...editingProfessor, email: event.target.value }) : setProfessor('email')} />
            <button className="flex items-center justify-center gap-2 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-700 sm:col-span-2"><Plus className="h-4 w-4" />{editingProfessor ? 'Enregistrer la fiche' : 'Ajouter un professeur'}</button>
          </form>
          <div className="mt-5 divide-y divide-slate-100">
            {professors.length ? professors.map((professor) => <div key={professor.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-900">{professor.nom} {professor.prenom}</p><p className="mt-1 text-xs text-slate-500">{professor.email || professor.telephone || 'Coordonnées non renseignées'} · {professor.affectations_actives || 0} affectation(s)</p></div><div className="flex items-center gap-3"><button type="button" onClick={() => showAssignments(professor)} className="text-xs font-medium text-violet-700 hover:text-violet-900">Affectations</button><span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${professor.actif ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{professor.actif ? 'Actif' : 'Inactif'}</span><button type="button" title="Modifier" onClick={() => setEditingProfessor({ ...professor })} className="text-slate-400 transition hover:text-violet-600"><Pencil className="h-4 w-4" /></button>{professor.actif && <button type="button" onClick={() => updateProfessor(professor.id, { ...professor, actif: false })} className="text-xs font-medium text-slate-500 hover:text-rose-600">Désactiver</button>}</div></div>) : <Empty>Aucun professeur n'est encore enregistré.</Empty>}
          </div>
          {selectedProfessor && <div className="mt-4 rounded-xl border border-violet-100 bg-violet-50/50 p-4"><div className="flex items-center justify-between gap-3"><p className="text-sm font-semibold text-slate-900">Affectations de {selectedProfessor.nom} {selectedProfessor.prenom}</p><button type="button" onClick={() => setSelectedProfessor(null)} className="text-xs text-slate-500 hover:text-slate-800">Fermer</button></div>{assignments.length ? <div className="mt-3 space-y-2">{assignments.map((item) => <div key={item.id} className="flex items-center justify-between gap-3 rounded-lg bg-white px-3 py-2 text-xs"><span className="text-slate-700">{item.code_affichage} · {item.matiere_nom || 'Titulaire'}</span>{item.actif ? <button type="button" onClick={() => endAssignment(item.id)} className="font-semibold text-rose-600 hover:text-rose-800">Terminer</button> : <span className="text-slate-400">Terminée</span>}</div>)}</div> : <p className="mt-3 text-xs text-slate-500">Aucune affectation enregistrée.</p>}</div>}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-5 flex items-start justify-between gap-4"><div><h3 className="font-semibold text-slate-900">Matières</h3><p className="mt-1 text-xs text-slate-500">Référentiel utilisé pour les affectations.</p></div><span className="grid h-9 w-9 place-items-center rounded-lg bg-sky-50 text-sky-600"><BookOpen className="h-4 w-4" /></span></div>
          <form onSubmit={submitSubject} className="space-y-3 border-b border-slate-100 pb-5"><Field label="Nom de la matière" value={editingSubject?.nom ?? subjectForm.nom} onChange={editingSubject ? (event) => setEditingSubject({ ...editingSubject, nom: event.target.value }) : setSubject('nom')} required /><Field label="Code" value={editingSubject?.code ?? subjectForm.code} onChange={editingSubject ? (event) => setEditingSubject({ ...editingSubject, code: event.target.value }) : setSubject('code')} /><button className="flex w-full items-center justify-center gap-2 rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-700"><Plus className="h-4 w-4" />{editingSubject ? 'Enregistrer la matière' : 'Ajouter une matière'}</button></form>
          <div className="mt-4 space-y-2">{subjects.length ? subjects.map((subject) => <div key={subject.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-3"><div><p className="text-sm font-medium text-slate-800">{subject.nom}</p><p className="text-xs text-slate-500">{subject.code || 'Sans code'}</p></div><div className="flex items-center gap-3"><span className={`text-[11px] font-semibold ${subject.actif ? 'text-emerald-600' : 'text-slate-400'}`}>{subject.actif ? 'Active' : 'Inactive'}</span><button type="button" title="Modifier" onClick={() => setEditingSubject({ ...subject })} className="text-slate-400 hover:text-sky-600"><Pencil className="h-4 w-4" /></button></div></div>) : <Empty>Aucune matière n'est encore configurée.</Empty>}</div>
        </section>
      </div>

      <section className="rounded-2xl border border-violet-100 bg-violet-50/40 p-5">
        <div className="mb-5 flex items-start gap-3"><span className="grid h-9 w-9 place-items-center rounded-lg bg-violet-600 text-white"><UserPlus className="h-4 w-4" /></span><div><h3 className="font-semibold text-slate-900">Affecter un professeur</h3><p className="mt-1 text-xs text-slate-600">L'affectation respecte le site et l'année scolaire active.</p></div></div>
        <form onSubmit={submitAssignment} className="grid gap-3 md:grid-cols-4 md:items-end"><Select label="Professeur" value={assignment.professorId} onChange={(event) => setAssignment({ ...assignment, professorId: event.target.value })} options={professors.filter((item) => item.actif).map((item) => ({ value: item.id, label: `${item.nom} ${item.prenom}` }))} required /><Select label="Classe" value={assignment.annualClassId} onChange={(event) => setAssignment({ ...assignment, annualClassId: event.target.value })} options={classes.map((item) => ({ value: item.id, label: item.code_affichage }))} required /><Select label="Matière" value={assignment.matiereId} onChange={(event) => setAssignment({ ...assignment, matiereId: event.target.value })} options={subjects.filter((item) => item.actif).map((item) => ({ value: item.id, label: item.nom }))} placeholder="Choisir une matière" /><button className="flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"><Check className="h-4 w-4" />Affecter</button></form>
        <p className="mt-3 text-xs text-slate-500">Pour un collège ou un lycée, la matière est obligatoire côté serveur.</p>
      </section>
    </div>
  );
}

function Field({ label, ...props }) { return <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}<input {...props} className="mt-2 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal normal-case tracking-normal text-slate-700 outline-none transition focus:border-violet-500" /></label>; }
function Select({ label, options, placeholder = 'Choisir', ...props }) { return <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}<select {...props} className="mt-2 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal normal-case tracking-normal text-slate-700 outline-none transition focus:border-violet-500"><option value="">{placeholder}</option>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>; }
function Empty({ children }) { return <p className="rounded-lg border border-dashed border-slate-200 p-4 text-sm text-slate-500">{children}</p>; }
