import { useState } from 'react';
import { cartesAPI } from '../services/api';

export default function CardServicePanel({ classes = [], cardService, canActivate = false, onToggle }) {
  const [selectedClass, setSelectedClass] = useState('');
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState('');
  const loadPreview = async () => {
    if (!selectedClass) return;
    setError('');
    try { setPreview((await cartesAPI.preview(selectedClass)).data); }
    catch (err) { setError(err.response?.data?.error || 'Impossible de charger les élèves pour les cartes.'); }
  };
  return <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <h2 className="text-xl font-semibold text-slate-900">Cartes FVS</h2>
    <p className="mt-1 text-sm text-slate-500">Les cartes utilisent les classes annuelles et les inscriptions actives.</p>
    {error && <p className="mt-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
    {!cardService?.actif && canActivate && <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4"><p className="text-sm text-amber-800">Le service Cartes est désactivé.</p><button type="button" className="mt-3 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white" onClick={onToggle}>Activer le service Cartes</button></div>}
    {!cardService?.actif && !canActivate && <p className="mt-5 rounded-lg bg-slate-50 p-4 text-sm text-slate-600">Le service Cartes n’est pas encore activé par la Direction.</p>}
    <div className="mt-5 flex flex-col gap-3 sm:flex-row">
      <select className="input flex-1" value={selectedClass} onChange={(event) => setSelectedClass(event.target.value)}>
        <option value="">Choisir une classe annuelle</option>
        {classes.map((item) => <option key={item.id} value={item.id}>{item.code_affichage || item.code}</option>)}
      </select>
      <button type="button" className="primary" onClick={loadPreview} disabled={!selectedClass}>Charger les élèves</button>
    </div>
    {preview && <div className="mt-5 rounded-xl border border-emerald-100 bg-emerald-50/40 p-4">
      <p className="font-semibold text-slate-900">{preview.classInfo.code_affichage} · {preview.totalCards} élève(s)</p>
      <div className="mt-3 divide-y divide-emerald-100">
        {preview.students.map((student) => <div key={student.id} className="py-2 text-sm text-slate-700">{student.nom} {student.prenom} <span className="text-slate-400">· {student.matricule}</span></div>)}
      </div>
      {!preview.students.length && <p className="mt-3 text-sm text-slate-500">Aucun élève inscrit dans cette classe.</p>}
    </div>}
  </section>;
}
