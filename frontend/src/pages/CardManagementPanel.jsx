import { useCallback, useEffect, useMemo, useState } from 'react';
import { FileText, Loader2, MessageSquare, Plus, Search, TriangleAlert } from 'lucide-react';
import { cartesAPI } from '../services/api';

const initialLostForm = { siteId: '', classeAnnuelleId: '', eleveId: '', details: '' };
const tabs = [
  { id: 'drafts', label: 'Brouillons', icon: FileText },
  { id: 'observations', label: 'Observations', icon: MessageSquare },
  { id: 'lost', label: 'Déclaration de cartes perdues', icon: TriangleAlert },
];

const formatDate = (value) => {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : '—';
};

export default function CardManagementPanel({ cardService, onNotice, onError }) {
  const [tab, setTab] = useState('drafts');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({ drafts: [], observations: [], classes: [] });
  const [declarations, setDeclarations] = useState([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [observation, setObservation] = useState('');
  const [lostForm, setLostForm] = useState(initialLostForm);
  const [lostStudents, setLostStudents] = useState([]);
  const [lostSearch, setLostSearch] = useState('');
  const [lostStudentsLoading, setLostStudentsLoading] = useState(false);
  const [draftPreview, setDraftPreview] = useState(null);
  const [loadingDraft, setLoadingDraft] = useState('');
  const [individualObservation, setIndividualObservation] = useState(null);
  const [individualContent, setIndividualContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState({ error: '', notice: '' });
  const sites = useMemo(() => (cardService?.sites || []).filter((site) => site.confirme_at), [cardService?.sites]);
  const reportError = useCallback((message) => {
    if (onError) onError(message);
    else setFeedback({ error: message, notice: '' });
  }, [onError]);
  const reportNotice = useCallback((message) => {
    if (onNotice) onNotice(message);
    else setFeedback({ error: '', notice: message });
  }, [onNotice]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [management, lost] = await Promise.all([cartesAPI.managementData(), cartesAPI.lostDeclarations()]);
      const nextData = management.data || { drafts: [], observations: [], classes: [] };
      setData(nextData);
      setDeclarations(lost.data?.declarations || []);
      setSelectedClass((current) => current || nextData.classes?.[0]?.id || '');
      setLostForm((current) => ({ ...current, siteId: current.siteId || sites[0]?.id || '' }));
    } catch (error) {
      reportError(error.response?.data?.error || 'Impossible de charger les informations Cartes.');
    } finally {
      setLoading(false);
    }
  }, [reportError, sites]);

  useEffect(() => { load(); }, [load]);

  const createObservation = async (event) => {
    event.preventDefault();
    if (!selectedClass || !observation.trim()) return;
    setSaving(true);
    try {
      await cartesAPI.createObservation(selectedClass, observation.trim());
      setObservation('');
      await load();
      reportNotice('Observation enregistrée.');
    } catch (error) {
      reportError(error.response?.data?.error || 'Impossible d’enregistrer l’observation.');
    } finally {
      setSaving(false);
    }
  };

  const openDraft = async (draft) => {
    setLoadingDraft(draft.id);
    setIndividualObservation(null);
    try {
      setDraftPreview((await cartesAPI.managementDraft(draft.id)).data);
    } catch (error) {
      reportError(error.response?.data?.error || 'Impossible de charger le brouillon.');
    } finally {
      setLoadingDraft('');
    }
  };

  const loadLostClass = async (classId) => {
    setLostForm((current) => ({ ...current, classeAnnuelleId: classId, eleveId: '' }));
    setLostSearch('');
    setLostStudents([]);
    if (!classId) return;
    setLostStudentsLoading(true);
    try {
      const { data: preview } = await cartesAPI.preview(classId);
      setLostStudents(preview.students || []);
    } catch (error) {
      reportError(error.response?.data?.error || 'Impossible de charger les élèves de cette classe.');
    } finally {
      setLostStudentsLoading(false);
    }
  };

  const createIndividualObservation = async (event) => {
    event.preventDefault();
    if (!individualObservation || !individualContent.trim()) return;
    setSaving(true);
    try {
      await cartesAPI.createObservation(draftPreview.classInfo.id, individualContent.trim(), individualObservation.id);
      setIndividualObservation(null);
      setIndividualContent('');
      await load();
      reportNotice(`Observation enregistrée pour ${individualObservation.nom} ${individualObservation.prenom}.`);
    } catch (error) {
      reportError(error.response?.data?.error || 'Impossible d’enregistrer l’observation individuelle.');
    } finally {
      setSaving(false);
    }
  };

  const createDeclaration = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      await cartesAPI.createLostDeclaration(lostForm);
      setLostForm((current) => ({ ...initialLostForm, siteId: current.siteId }));
      setLostStudents([]);
      setLostSearch('');
      await load();
      reportNotice('Déclaration de carte perdue enregistrée.');
    } catch (error) {
      reportError(error.response?.data?.error || 'Impossible d’enregistrer la déclaration.');
    } finally {
      setSaving(false);
    }
  };

  const lostClasses = data.classes.filter((item) => item.site_id === lostForm.siteId);
  const matchingLostStudents = lostStudents.filter((student) => {
    const term = lostSearch.trim().toLocaleLowerCase('fr');
    return !term || [student.matricule, student.nom, student.prenom].some((value) => String(value || '').toLocaleLowerCase('fr').includes(term));
  });

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-5">
        <h2 className="text-xl font-semibold text-slate-900">Cartes d’identité scolaire</h2>
        <p className="mt-1 text-sm text-slate-500">Brouillons, observations et déclarations de cartes perdues.</p>
      </div>
      {feedback.error && <p role="alert" className="mb-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{feedback.error}</p>}
      {feedback.notice && <p role="status" className="mb-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">{feedback.notice}</p>}

      <nav className="mb-5 flex flex-wrap gap-2 border-b border-slate-200 pb-3">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button key={id} type="button" onClick={() => setTab(id)} className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${tab === id ? 'bg-emerald-50 text-emerald-700' : 'text-slate-500 hover:bg-slate-50'}`}>
            <Icon className="h-4 w-4" />{label}
          </button>
        ))}
      </nav>

      {loading ? <p className="py-8 text-center text-sm text-slate-500">Chargement...</p> : (
        <>
          {tab === 'drafts' && (
            <div className="space-y-4">
              {data.drafts.length ? data.drafts.map((draft) => (
                <article key={draft.id} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="mr-auto">
                      <p className="font-semibold text-slate-800">{draft.nom}</p>
                      <p className="mt-1 text-xs text-slate-500">{draft.site_nom} · {draft.classe_code} · {draft.annee_libelle} · {draft.total_cartes} carte(s) · {draft.statut === 'pret' ? 'Prêt' : 'Brouillon'}</p>
                    </div>
                    <span className="text-xs text-slate-500">{formatDate(draft.created_at)}</span>
                    <button type="button" onClick={() => openDraft(draft)} disabled={!!loadingDraft} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">
                      {loadingDraft === draft.id ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Charger le brouillon'}
                    </button>
                  </div>
                </article>
              )) : <p className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">Aucun brouillon enregistré.</p>}
              {draftPreview && (
                <section className="rounded-xl border border-emerald-200 bg-emerald-50/30 p-4">
                  <div className="mb-4 flex flex-wrap items-center gap-3">
                    <div className="mr-auto">
                      <h3 className="font-semibold text-slate-800">{draftPreview.classInfo.code_affichage} · {draftPreview.classInfo.site_nom}</h3>
                      <p className="mt-1 text-xs text-slate-500">{draftPreview.students.length} élève(s) dans ce brouillon</p>
                    </div>
                    <button type="button" onClick={() => { setIndividualObservation(null); setDraftPreview(null); }} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600">Fermer</button>
                  </div>
                  {individualObservation && (
                    <form onSubmit={createIndividualObservation} className="mb-4 rounded-lg border border-slate-200 bg-white p-3">
                      <p className="mb-2 text-sm font-medium text-slate-700">Observation pour {individualObservation.nom} {individualObservation.prenom}</p>
                      <textarea required autoFocus maxLength={5000} rows={3} value={individualContent} onChange={(event) => setIndividualContent(event.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="Saisir l’observation..." />
                      <div className="mt-2 flex justify-end gap-2">
                        <button type="button" onClick={() => setIndividualObservation(null)} className="rounded-lg border px-3 py-2 text-xs text-slate-600">Annuler</button>
                        <button type="submit" disabled={saving || !individualContent.trim()} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">{saving ? 'Enregistrement...' : 'Enregistrer'}</button>
                      </div>
                    </form>
                  )}
                  {draftPreview.students.length ? <div className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
                    {draftPreview.students.map((student) => (
                      <div key={student.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
                        <div className="mr-auto">
                          <p className="text-sm font-medium text-slate-800">{student.nom} {student.prenom}</p>
                          <p className="text-xs text-slate-500">{student.matricule}</p>
                        </div>
                        <button type="button" onClick={() => { setIndividualObservation(student); setIndividualContent(''); }} className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 px-3 py-2 text-xs font-medium text-emerald-700 hover:bg-emerald-50"><MessageSquare className="h-3.5 w-3.5" />Observation</button>
                      </div>
                    ))}
                  </div> : <p className="rounded-lg border border-dashed border-slate-200 bg-white p-5 text-center text-sm text-slate-500">Aucun élève dans cette classe.</p>}
                </section>
              )}
            </div>
          )}

          {tab === 'observations' && (
            <div className="space-y-5">
              <form onSubmit={createObservation} className="space-y-3 rounded-xl border border-slate-200 p-4">
                <label className="block text-xs font-medium text-slate-600">Classe concernée</label>
                <select value={selectedClass} onChange={(event) => setSelectedClass(event.target.value)} required className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
                  <option value="">Choisir une classe</option>
                  {data.classes.map((item) => <option key={item.id} value={item.id}>{item.site_nom} · {item.code_affichage}</option>)}
                </select>
                <label className="block text-xs font-medium text-slate-600">Observation</label>
                <textarea value={observation} onChange={(event) => setObservation(event.target.value)} maxLength={5000} required rows={3} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" placeholder="Saisir une observation liée aux cartes..." />
                <button type="submit" disabled={saving || !data.classes.length} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"><Plus className="h-4 w-4" />Enregistrer</button>
              </form>
              {data.observations.length ? data.observations.map((item) => (
                <article key={item.id} className="rounded-xl border border-slate-200 p-4">
                  <div className="mb-2 flex flex-wrap justify-between gap-2 text-xs text-slate-500"><span className="font-medium text-emerald-700">{item.site_nom} · {item.classe_code}</span><span>{formatDate(item.created_at)}</span></div>
                  <p className="whitespace-pre-wrap text-sm text-slate-700">{item.contenu}</p>
                  {item.eleve_nom && <p className="mt-2 text-xs text-emerald-700">Élève : {item.eleve_prenom} {item.eleve_nom} · {item.eleve_matricule}</p>}
                  <p className="mt-2 text-xs text-slate-400">{[item.auteur_prenom, item.auteur_nom].filter(Boolean).join(' ') || item.auteur_role}</p>
                </article>
              )) : <p className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">Aucune observation enregistrée.</p>}
            </div>
          )}

          {tab === 'lost' && (
            <div className="space-y-5">
              <form onSubmit={createDeclaration} className="grid gap-3 rounded-xl border border-slate-200 p-4 sm:grid-cols-2">
                <label className="text-xs font-medium text-slate-600">Site
                  <select required value={lostForm.siteId} onChange={(event) => { setLostForm({ ...initialLostForm, siteId: event.target.value }); setLostStudents([]); setLostSearch(''); }} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
                    <option value="">Choisir un site</option>
                    {sites.map((site) => <option key={site.id} value={site.id}>{site.nom}</option>)}
                  </select>
                </label>
                <label className="text-xs font-medium text-slate-600">Classe
                  <select required disabled={!lostForm.siteId} value={lostForm.classeAnnuelleId} onChange={(event) => loadLostClass(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm disabled:bg-slate-50">
                    <option value="">Choisir une classe</option>
                    {lostClasses.map((item) => <option key={item.id} value={item.id}>{item.code_affichage}</option>)}
                  </select>
                </label>
                <label className="text-xs font-medium text-slate-600 sm:col-span-2">Rechercher l’élève
                  <div className="relative mt-1">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <input value={lostSearch} onChange={(event) => setLostSearch(event.target.value)} disabled={!lostForm.classeAnnuelleId} placeholder="Matricule, nom ou prénom" className="w-full rounded-lg border border-slate-200 px-3 py-2 pl-9 text-sm disabled:bg-slate-50" />
                  </div>
                </label>
                <label className="text-xs font-medium text-slate-600 sm:col-span-2">Élève
                  <select required disabled={!lostForm.classeAnnuelleId || lostStudentsLoading} value={lostForm.eleveId} onChange={(event) => setLostForm({ ...lostForm, eleveId: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm disabled:bg-slate-50">
                    <option value="">{lostStudentsLoading ? 'Chargement des élèves...' : 'Choisir un élève'}</option>
                    {matchingLostStudents.map((student) => <option key={student.id} value={student.id}>{student.matricule} · {student.nom} {student.prenom}</option>)}
                  </select>
                </label>
                <label className="text-xs font-medium text-slate-600 sm:col-span-2">Précisions
                  <textarea maxLength={2000} rows={3} value={lostForm.details} onChange={(event) => setLostForm({ ...lostForm, details: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="Indiquez les informations utiles concernant la perte de la carte..." />
                </label>
                <button type="submit" disabled={saving || !lostForm.siteId || !lostForm.classeAnnuelleId || !lostForm.eleveId} className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 sm:col-span-2"><Plus className="h-4 w-4" />Enregistrer la déclaration</button>
              </form>
              {declarations.length ? declarations.map((item) => (
                <article key={item.id} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex flex-wrap justify-between gap-2">
                    <p className="font-semibold text-slate-800">{item.nom_eleve} {item.prenom_eleve} <span className="font-normal text-slate-500">· {item.matricule}</span></p>
                    <span className="text-xs text-slate-500">{formatDate(item.created_at)}</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{item.site_nom}{item.classe ? ` · ${item.classe}` : ''}</p>
                  {item.details && <p className="mt-3 whitespace-pre-wrap text-sm text-slate-600">{item.details}</p>}
                </article>
              )) : <p className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">Aucune déclaration enregistrée.</p>}
            </div>
          )}
        </>
      )}
    </section>
  );
}
