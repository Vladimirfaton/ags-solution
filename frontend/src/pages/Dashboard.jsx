import { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  FileText, CreditCard, LogOut, Trash2, Search, MapPin, Upload, Download,
  FileSpreadsheet, Image as ImageIcon, Check, X, Users, School, IdCard,
  ChevronRight, Plus, Pencil, ArrowLeft, Loader2, Printer, Settings2, FileDown,
  KeyRound, Mail,Bell,Send, ChevronDown,
} from 'lucide-react';
import api, { collegeAPI, classAPI, studentAPI, importAPI, observationAPI, FILE_BASE_URL } from '../services/api';
import { PLATFORM_NAME } from '../config/branding';
import ObservationsPanel from '../components/ObservationsPanel';
import {
  generateBrouillonPDF, generateCollegeBrouillonPDF,
  generateFinalCardsPDF, generateSingleCardPDF, generateCardImages,
  printFinalCards, getSchoolYear, DEFAULT_CARD_MM, wrapText, fitTitleSize,
} from '../utils/pdfUtils';

const NIVEAU_ORDRE = ['6ème', '5ème', '4ème', '3ème', '2nde', '1ère', 'Tle', 'Terminale'];

const rangNiveau = (niveau = '') => {
  const n = niveau.trim().toLowerCase();
  const i = NIVEAU_ORDRE.findIndex(x => x.toLowerCase() === n);
  return i === -1 ? 999 : i;
};

const trierClasses = (list) =>
  [...list].sort((a, b) => {
    const ra = rangNiveau(a.niveau);
    const rb = rangNiveau(b.niveau);
    if (ra !== rb) return ra - rb;
    if (ra === 999 && a.niveau !== b.niveau) {
      return a.niveau.localeCompare(b.niveau, 'fr');
    }
    return (a.serie || '').localeCompare(b.serie || '', 'fr', { numeric: true });
  });

// Depuis la migration vers Supabase Storage, photo_path/signature_path contiennent
// deja l'URL publique complete -> on l'utilise telle quelle. Les anciens enregistrements
// (avant migration) contiennent encore un chemin local -> on reconstruit /uploads/...
// comme avant, pour rester compatible avec les donnees existantes.
const resolveFileUrl = (value, folder) => {
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  return `${FILE_BASE_URL}/uploads/${folder}/${value.split(/[\\/]/).pop()}`;
};

const photoUrl = (path) => resolveFileUrl(path, 'photos');

const signatureUrl = (path) => resolveFileUrl(path, 'signatures');

const parseDatePassage = (str) => {
  const match = str.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})$/);
  if (!match) return null;
  const [, day, month, year, hour, min] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(min));
  return isNaN(date.getTime()) ? null : date.toISOString();
};

export default function Dashboard({ onLogout }) {
  const [searchParams, setSearchParams] = useSearchParams();

  const [loading, setLoading] = useState(true);

  const [departments, setDepartments] = useState([]);
  const [communes, setCommunes] = useState([]);
  const [selectedDept, setSelectedDept] = useState('');
  const [selectedCommune, setSelectedCommune] = useState('');

  const [allColleges, setAllColleges] = useState([]);
  const [activeCollege, setActiveCollege] = useState(null);
  const [classes, setClasses] = useState([]);
  const [activeClass, setActiveClass] = useState(null);
  const [students, setStudents] = useState([]);

  const [showCollegeForm, setShowCollegeForm] = useState(false);
  const [editingCollege, setEditingCollege] = useState(null);
    const [unreadObs, setUnreadObs] = useState([]);
  const [showObsDropdown, setShowObsDropdown] = useState(false);
  const obsDropdownRef = useRef(null);

  useEffect(() => {
    const fetchUnread = async () => {
      try {
        const res = await observationAPI.getUnread();
        setUnreadObs(res.data.observations || []);
      } catch {}
    };
    fetchUnread();
    const interval = setInterval(fetchUnread, 60000);
    return () => clearInterval(interval);
  }, []);

  // Fermer le dropdown si clic en dehors
  useEffect(() => {
    const handler = (e) => {
      if (obsDropdownRef.current && !obsDropdownRef.current.contains(e.target)) {
        setShowObsDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleMarkAllRead = async () => {
    try {
      await observationAPI.markAsRead();
      setUnreadObs([]);
      setShowObsDropdown(false);
    } catch {}
  };
  useEffect(() => {
    api.get('/locations/departements')
      .then(r => setDepartments(r.data || []))
      .catch(() => setDepartments([]));
    loadAllColleges();
  }, []);

  useEffect(() => {
    const collegeId = searchParams.get('college');
    const classeId = searchParams.get('classe');
    if (!collegeId) return;

    (async () => {
      setLoading(true);
      try {
        const collegeRes = await collegeAPI.getById(collegeId);
        const college = collegeRes.data;
        setActiveCollege(college);

        const classesRes = await classAPI.getByCollege(collegeId);
        setClasses(trierClasses(classesRes.data || []));

        if (classeId) {
          const studentsRes = await studentAPI.getByClass(classeId);
          setActiveClass(studentsRes.data?.classInfo);
          setStudents(studentsRes.data?.students || []);
        }
      } catch {
        setSearchParams({});
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setSelectedCommune('');
    if (!selectedDept) { setCommunes([]); return; }
    api.get(`/locations/communes/${selectedDept}`)
      .then(r => setCommunes(r.data || []))
      .catch(() => setCommunes([]));
  }, [selectedDept]);

  const loadAllColleges = async () => {
    setLoading(true);
    try {
      const r = await collegeAPI.getAll();
      setAllColleges(r.data || []);
    } catch {
      setAllColleges([]);
    } finally {
      setLoading(false);
    }
  };

  const refreshDashboardStats = async () => {
    try {
      const r = await collegeAPI.getAll();
      setAllColleges(r.data || []);
    } catch {
      setAllColleges([]);
    }
  };

  const filteredColleges = useMemo(() => {
    return allColleges.filter(c =>
      (!selectedDept || c.departement === selectedDept) &&
      (!selectedCommune || c.commune === selectedCommune)
    );
  }, [allColleges, selectedDept, selectedCommune]);

  const stats = useMemo(() => ({
    colleges: allColleges.length,
    students: allColleges.reduce((s, c) => s + (c.students_count || 0), 0),
    cards: allColleges.reduce((s, c) => s + (c.cards_generated || 0), 0),
  }), [allColleges]);

  const openCollege = async (college) => {
    setActiveCollege(college);
    setActiveClass(null);
    setStudents([]);
    setSearchParams({ college: college.id });
    setLoading(true);
    try {
      const res = await classAPI.getByCollege(college.id);
      setClasses(trierClasses(res.data || []));
      await refreshDashboardStats();
    } catch {
      setClasses([]);
    } finally {
      setLoading(false);
    }
  };

  const openClass = async (cls) => {
    setActiveClass(cls);
    setSearchParams({ college: activeCollege.id, classe: cls.id });
    setLoading(true);
    try {
      const r = await studentAPI.getByClass(cls.id);
      setStudents(r.data?.students || r.data || []);
    } catch {
      setStudents([]);
    } finally {
      setLoading(false);
    }
  };

  const refreshStudents = async () => {
    if (!activeClass) return;
    try {
      const r = await studentAPI.getByClass(activeClass.id);
      setStudents(r.data?.students || r.data || []);
      await refreshDashboardStats();
    } catch {
      // silencieux
    }
  };

  const goBack = () => {
    if (activeClass) {
      setActiveClass(null);
      setStudents([]);
      setSearchParams({ college: activeCollege.id });
    } else if (activeCollege) {
      setActiveCollege(null);
      setClasses([]);
      setSearchParams({});
    }
  };

  const canCreate = !!selectedDept && !!selectedCommune;

  return (
    <div className="min-h-screen bg-[#f7faf8]">
            <header className="sticky top-0 z-30 bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-600 flex items-center justify-center">
              <IdCard className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-slate-800 leading-tight">{PLATFORM_NAME}</h1>
              <p className="text-xs text-slate-500">Gestion complète des cartes d'identité scolaires</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Cloche notifications observations */}
            <div className="relative" ref={obsDropdownRef}>
              <button
                onClick={() => setShowObsDropdown(v => !v)}
                className="relative flex items-center justify-center w-9 h-9 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                title="Observations non lues"
              >
                <Bell className="w-4 h-4" />
                {unreadObs.length > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none">
                    {unreadObs.length > 9 ? '9+' : unreadObs.length}
                  </span>
                )}
              </button>

              {showObsDropdown && (
                <div className="absolute right-0 top-11 w-96 bg-white border border-slate-200 rounded-xl shadow-lg z-50 overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                    <span className="text-sm font-semibold text-slate-800">
                      Observations
                      {unreadObs.length > 0 && (
                        <span className="ml-2 text-xs font-medium text-rose-500">
                          {unreadObs.length} non lue{unreadObs.length > 1 ? 's' : ''}
                        </span>
                      )}
                    </span>
                    {unreadObs.length > 0 && (
                      <button
                        onClick={handleMarkAllRead}
                        className="text-xs text-emerald-600 hover:text-emerald-700 font-medium cursor-pointer"
                      >
                        Tout marquer lu
                      </button>
                    )}
                  </div>

                  <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                    {unreadObs.length === 0 ? (
                      <p className="text-sm text-slate-400 text-center py-6">
                        Aucune observation non lue
                      </p>
                    ) : (
                      unreadObs.map((o) => (
                        <div key={o.id} className="px-4 py-3 hover:bg-slate-50 transition">
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <span className="text-xs font-medium text-emerald-700 truncate">
                              {o.college_nom}
                            </span>
                            <span className="text-xs text-slate-400 shrink-0">
                              {new Date(o.created_at).toLocaleString('fr-FR', {
                                day: '2-digit', month: '2-digit',
                                hour: '2-digit', minute: '2-digit',
                              })}
                            </span>
                          </div>
                          <div className="text-xs text-slate-500 mb-1">
                            {o.classe_code} ·{' '}
                            {o.auteur_prenom || o.auteur_nom
                              ? `${o.auteur_prenom || ''} ${o.auteur_nom || ''}`.trim()
                              : o.auteur_role}
                          </div>
                          <p className="text-sm text-slate-700 line-clamp-2">{o.contenu}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={onLogout}
              className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              Déconnexion
            </button>
          </div>
        </div>
      </header>

      {!activeCollege && (
        <div className="sticky top-[73px] z-20 bg-[#f7faf8] border-b border-slate-200">
          <div className="max-w-7xl mx-auto px-6 py-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <StatCard icon={School} label="Collèges" value={stats.colleges} color="emerald" />
              <StatCard icon={Users} label="Élèves" value={stats.students} color="cyan" />
              <StatCard icon={CreditCard} label="Cartes générées" value={stats.cards} color="violet" />
            </div>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-6 py-8">
        {!activeCollege && (
          <div className="flex items-center gap-2 mb-5 text-sm">
            <span className="text-slate-700 font-medium">Collèges</span>
          </div>
        )}

        {activeCollege && (
          <div className="flex items-center gap-2 mb-5 text-sm">
            <button onClick={goBack} className="flex items-center gap-1.5 text-slate-500 hover:text-slate-800 cursor-pointer">
              <ArrowLeft className="w-4 h-4" />
              Retour
            </button>
            <span className="text-slate-300">|</span>
            <span className="text-slate-700 font-medium">{activeCollege.nom}</span>
            {activeClass && (
              <>
                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-emerald-700 font-medium">{activeClass.code}</span>
              </>
            )}
          </div>
        )}

        {!activeCollege && (
          <div className="bg-white border border-slate-200 rounded-xl p-5 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
              <Field label="Département">
                <select
                  value={selectedDept}
                  onChange={e => setSelectedDept(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                >
                  <option value="">Sélectionner un département</option>
                  {departments.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </Field>
              <Field label="Commune">
                <select
                  value={selectedCommune}
                  onChange={e => setSelectedCommune(e.target.value)}
                  disabled={!selectedDept}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <option value="">Sélectionner une commune</option>
                  {communes.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
              <div>
                <button
                  onClick={() => { setEditingCollege(null); setShowCollegeForm(true); }}
                  disabled={!canCreate}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  Nouveau collège
                </button>
                {!canCreate && (
                  <p className="text-xs text-slate-400 mt-1.5">
                    Choisissez un département et une commune
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {!activeCollege && showCollegeForm && (
          <CollegeFormPanel
            mode={editingCollege ? 'edit' : 'create'}
            initial={editingCollege}
            departement={selectedDept}
            commune={selectedCommune}
            onClose={() => { setShowCollegeForm(false); setEditingCollege(null); }}
            onSaved={loadAllColleges}
          />
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20 text-slate-400">
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
            <span className="text-sm">Chargement</span>
          </div>
        ) : (
          <>
            {!activeCollege && (
              <CollegeGrid
                colleges={filteredColleges}
                hasFilter={!!selectedDept || !!selectedCommune}
                onOpen={openCollege}
                onEdit={c => { setEditingCollege(c); setShowCollegeForm(true); }}
              />
            )}

            {activeCollege && !activeClass && (
              <ClassGrid
                classes={classes}
                onOpen={openClass}
                collegeId={activeCollege.id}
                collegeNom={activeCollege.nom}
                collegeInfo={activeCollege}
                onRefresh={() => openCollege(activeCollege)}
              />
            )}

            {activeCollege && activeClass && (
              <ClassPanel
                cls={activeClass}
                students={students}
                collegeInfo={activeCollege}
                onRefresh={refreshStudents}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* ============== primitives ============== */

const COLORS = {
  emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600' },
  cyan: { bg: 'bg-cyan-50', text: 'text-cyan-600' },
  violet: { bg: 'bg-violet-50', text: 'text-violet-600' },
};

function StatCard({ icon: Icon, label, value, color }) {
  const c = COLORS[color];
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-4">
      <div className={`w-10 h-10 rounded-lg ${c.bg} flex items-center justify-center`}>
        <Icon className={`w-5 h-5 ${c.text}`} />
      </div>
      <div>
        <div className="text-xs text-slate-500 font-medium">{label}</div>
        <div className="text-2xl font-semibold text-slate-800 leading-tight">{value}</div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function Panel({ children }) {
  return <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">{children}</div>;
}

function Notice({ type = 'error', children, onClose }) {
  const styles = type === 'error'
    ? 'bg-rose-50 border-rose-200 text-rose-700'
    : 'bg-emerald-50 border-emerald-200 text-emerald-700';
  return (
    <div className={`mb-4 flex items-start gap-2 px-4 py-3 border rounded-lg text-sm ${styles}`}>
      {type === 'error' ? <X className="w-4 h-4 mt-0.5 shrink-0" /> : <Check className="w-4 h-4 mt-0.5 shrink-0" />}
      <span className="flex-1">{children}</span>
      {onClose && (
        <button onClick={onClose} className="cursor-pointer shrink-0">
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

/* ============== Collèges ============== */

function CollegeGrid({ colleges, hasFilter, onOpen, onEdit }) {
  if (!colleges.length) {
    return (
      <Panel>
        <p className="text-sm text-slate-500">
          {hasFilter ? 'Aucun collège ne correspond à ces critères.' : 'Aucun collège enregistré pour le moment.'}
        </p>
      </Panel>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {colleges.map(c => (
        <div
          key={c.id}
          onClick={() => onOpen(c)}
          className="bg-white border border-slate-200 hover:border-emerald-300 rounded-xl p-5 cursor-pointer transition group"
        >
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
                <School className="w-4 h-4 text-emerald-600" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-800 group-hover:text-emerald-700 transition">{c.nom}</h3>
                <p className="text-xs text-slate-500 mt-0.5">{c.commune}, {c.departement}</p>
              </div>
            </div>
            <button
              onClick={e => { e.stopPropagation(); onEdit(c); }}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md cursor-pointer"
              title="Modifier"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="text-xs text-slate-600 space-y-1 pl-12">
            <div>Directeur : { (c.directeur_prenom || c.directeur_nom) ? `${c.directeur_prenom ? c.directeur_prenom + ' ' : ''}${c.directeur_nom || ''}` : '—' }</div>
            <div>Téléphone : {c.telephone || '—'}</div>
          </div>

          <div className="flex items-center gap-1 mt-4 pl-12 text-xs font-medium text-emerald-700">
            Voir les classes
            <ChevronRight className="w-3.5 h-3.5" />
          </div>
        </div>
      ))}
    </div>
  );
}

function CollegeFormPanel({ mode, initial, departement, commune, onClose, onSaved }) {
  const [form, setForm] = useState({
    nom: initial?.nom || '',
    slogan: initial?.slogan || '',
    adresse_postale: initial?.adresse_postale || '',
    directeur_prenom: initial?.directeur_prenom || '',
    directeur_nom: initial?.directeur_nom || '',
    directeur_contact: initial?.directeur_contact || '',
    email: initial?.email || '',
    telephone: initial?.telephone || '',
  });
  const [showSecretaireForm, setShowSecretaireForm] = useState(
    !!(initial?.secretaire_nom || initial?.secretaire_prenom || initial?.secretaire_email)
  );
  const [secretaireForm, setSecretaireForm] = useState({
    secretaire_nom: initial?.secretaire_nom || '',
    secretaire_prenom: initial?.secretaire_prenom || '',
    secretaire_telephone: initial?.secretaire_telephone || '',
    secretaire_email: initial?.secretaire_email || '',
  });
  const [signature, setSignature] = useState(null);
  const [signaturePreview, setSignaturePreview] = useState(
    initial?.signature_path ? signatureUrl(initial.signature_path) : null
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const loc = mode === 'edit'
    ? { departement: initial.departement, commune: initial.commune }
    : { departement, commune };

  const handleSignature = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!['image/png', 'image/jpeg'].includes(file.type)) {
      setError('La signature doit être en PNG ou JPEG');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError('La signature ne doit pas dépasser 2 Mo');
      return;
    }
    setError('');
    setSignature(file);
    const reader = new FileReader();
    reader.onloadend = () => setSignaturePreview(reader.result);
    reader.readAsDataURL(file);
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.nom.trim()) return setError('Le nom du collège est requis');
    if (!form.directeur_prenom.trim() || !form.directeur_nom.trim()) return setError('Le prénom et le nom du directeur sont requis');

    setSaving(true);
    try {
      const secretaireData = showSecretaireForm ? secretaireForm : {};

      let id = initial?.id;
      if (mode === 'edit') {
        await collegeAPI.update(id, { ...form, ...secretaireData });
      } else {
        const res = await collegeAPI.create({ ...form, ...loc, ...secretaireData });
        id = res.data.id;
      }
      if (signature && id) await collegeAPI.uploadSignature(id, signature);
      onSaved();
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || "Erreur lors de l'enregistrement");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="bg-white border border-emerald-200 rounded-xl p-6 mb-6">
      <h3 className="text-sm font-semibold text-slate-800 mb-4">
        {mode === 'edit' ? 'Modifier le collège' : 'Nouveau collège'}
      </h3>

      <div className="flex items-center gap-2 px-4 py-3 bg-emerald-50 border border-emerald-100 rounded-lg mb-5">
        <MapPin className="w-4 h-4 text-emerald-600 shrink-0" />
        <span className="text-sm text-emerald-800">{loc.commune}, {loc.departement}</span>
      </div>

      {error && <Notice>{error}</Notice>}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-slate-600 mb-1.5">Nom du collège</label>
          <input
            type="text"
            value={form.nom}
            onChange={e => setForm({ ...form, nom: e.target.value })}
            placeholder="Collège Catholique Ste Cécile"
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            required
          />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-slate-600 mb-1.5">Slogan (optionnel)</label>
          <input
            type="text"
            value={form.slogan}
            onChange={e => setForm({ ...form, slogan: e.target.value })}
            placeholder="Prière - Travail - Excellence"
            maxLength={150}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
                <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-slate-600 mb-1.5">Adresse postale (BP, quartier...)</label>
          <input
            type="text"
            value={form.adresse_postale}
            onChange={e => setForm({ ...form, adresse_postale: e.target.value })}
            placeholder="72 BP 165"
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
        <>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Prénom du directeur</label>
            <input
              type="text"
              value={form.directeur_prenom}
              onChange={e => setForm({ ...form, directeur_prenom: e.target.value })}
              placeholder="Victor"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Nom du directeur</label>
            <input
              type="text"
              value={form.directeur_nom}
              onChange={e => setForm({ ...form, directeur_nom: e.target.value })}
              placeholder="LAMODI"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              required
            />
          </div>
        </>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1.5">Email du directeur</label>
          <input
            type="email"
            value={form.directeur_contact}
            onChange={e => setForm({ ...form, directeur_contact: e.target.value })}
            placeholder="directeur@college.com"
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1.5">Téléphone</label>
          <input
            type="tel"
            value={form.telephone}
            onChange={e => setForm({ ...form, telephone: e.target.value })}
            placeholder="+229 97 268 741"
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-slate-600 mb-1.5">Email du collège</label>
          <input
            type="email"
            value={form.email}
            onChange={e => setForm({ ...form, email: e.target.value })}
            placeholder="contact@college.com"
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
      </div>

      <div className="mb-5">
        {!showSecretaireForm ? (
          <button
            type="button"
            onClick={() => setShowSecretaireForm(true)}
            className="flex items-center gap-2 text-xs font-medium text-emerald-700 hover:text-emerald-800 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Informations supplémentaires (secrétaire)
          </button>
        ) : (
          <div className="border border-slate-200 rounded-lg p-4 bg-slate-50">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-medium text-slate-600">Informations de la secrétaire</p>
              <button
                type="button"
                onClick={() => setShowSecretaireForm(false)}
                className="text-xs text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                Masquer
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Prénom"
                value={secretaireForm.secretaire_prenom}
                onChange={v => setSecretaireForm({ ...secretaireForm, secretaire_prenom: v })}
                placeholder="Chimène"
              />
              <Input
                label="Nom"
                value={secretaireForm.secretaire_nom}
                onChange={v => setSecretaireForm({ ...secretaireForm, secretaire_nom: v })}
                placeholder="AGOSSOU"
              />
              <Input
                label="Téléphone"
                value={secretaireForm.secretaire_telephone}
                onChange={v => setSecretaireForm({ ...secretaireForm, secretaire_telephone: v })}
                placeholder="+229 90 00 00 00"
              />
              <Input
                label="Email"
                type="email"
                value={secretaireForm.secretaire_email}
                onChange={v => setSecretaireForm({ ...secretaireForm, secretaire_email: v })}
                placeholder="secretaire@college.com"
              />
            </div>
          </div>
        )}
      </div>

      <div className="mb-5">
        <label className="block text-xs font-medium text-slate-600 mb-1.5">
          Signature du directeur (PNG/JPEG, 200×80px)
        </label>
        <input
          type="file"
          accept="image/png,image/jpeg"
          onChange={handleSignature}
          className="block w-full text-sm text-slate-600 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200 file:cursor-pointer"
        />
        {signaturePreview && (
          <div className="mt-3 border border-slate-200 rounded-lg p-3 bg-slate-50 inline-block">
            <img src={signaturePreview} alt="Signature" style={{ maxWidth: 200, maxHeight: 80 }} />
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white rounded-lg text-sm font-medium cursor-pointer"
        >
          {saving ? 'Enregistrement' : mode === 'edit' ? 'Enregistrer' : 'Créer le collège'}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium cursor-pointer"
        >
          Annuler
        </button>
      </div>
    </form>
  );
}

/* ============== Classes ============== */

function ClassGrid({ classes, onOpen, collegeId, collegeNom, collegeInfo, onRefresh }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ niveau: '', serie: '' });
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [generatingCollege, setGeneratingCollege] = useState(false);
  const [notifyingCollege, setNotifyingCollege] = useState(false);
  const [notifyingCartesCollege, setNotifyingCartesCollege] = useState(false);
  const [showNotifMenu, setShowNotifMenu] = useState(false);
  const notifMenuRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (notifMenuRef.current && !notifMenuRef.current.contains(e.target)) {
        setShowNotifMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);
  const [creatingComptes, setCreatingComptes] = useState(false);
  const [showSecretaireModal, setShowSecretaireModal] = useState(false);
  const [secretaireModalForm, setSecretaireModalForm] = useState({
    secretaire_nom: '', secretaire_prenom: '', secretaire_telephone: '', secretaire_email: '',
  });

  const flash = (msg) => { setNotice(msg); setTimeout(() => setNotice(''), 5000); };

  const handleCreateComptes = async (extra = {}) => {
    setError('');
    setCreatingComptes(true);
    try {
      await collegeAPI.createManagementAccounts(collegeId, extra);
      setShowSecretaireModal(false);
      flash('Comptes de gestion créés — identifiants envoyés par email au directeur et à la secrétaire');
    } catch (err) {
      const code = err.response?.data?.code;
      if (code === 'SECRETAIRE_INFO_REQUIRED') {
        setShowSecretaireModal(true);
      } else {
        setError(err.response?.data?.error || 'Erreur lors de la création des comptes de gestion');
      }
    } finally {
      setCreatingComptes(false);
    }
  };

  const handleResendManagementActivationEmails = async () => {
    setError('');
    setCreatingComptes(true);
    try {
      const res = await collegeAPI.resendManagementActivationEmails(collegeId);
      flash(`${res.data.sent} lien(s) d’activation renvoyé(s)`);
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur lors du renvoi des liens d’activation');
    } finally {
      setCreatingComptes(false);
    }
  };

  const submitSecretaireModal = (e) => {
    e.preventDefault();
    handleCreateComptes(secretaireModalForm);
  };

  const reset = () => {
    setForm({ niveau: '', serie: '' });
    setEditingId(null);
    setShowForm(false);
    setError('');
  };

  const openCreate = () => {
    setForm({ niveau: '', serie: '' });
    setEditingId(null);
    setError('');
    setShowForm(true);
  };

  const openEdit = (cls) => {
    setForm({ niveau: cls.niveau, serie: cls.serie });
    setEditingId(cls.id);
    setError('');
    setShowForm(true);
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      if (editingId) await classAPI.update(editingId, form);
      else await classAPI.create(collegeId, form);
      reset();
      onRefresh();
    } catch (err) {
      setError(err.response?.data?.error || "Erreur lors de l'enregistrement");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (cls) => {
    if (!confirm(`Supprimer la classe ${cls.code} et tous ses élèves ?`)) return;
    try {
      await classAPI.delete(cls.id);
      onRefresh();
    } catch {
      setError('Erreur lors de la suppression');
    }
  };

  const handleCollegeBrouillon = async () => {
    setError('');
    setGeneratingCollege(true);
    try {
      const withStudents = [];
      for (const cls of classes) {
        const res = await studentAPI.getByClass(cls.id);
        withStudents.push({ classInfo: cls, students: res.data?.students || res.data || [] });
      }
      await generateCollegeBrouillonPDF(withStudents, collegeInfo);
    } catch {
      setError('Erreur lors de la génération du brouillon du collège');
    } finally {
      setGeneratingCollege(false);
    }
  };
  const handleNotifyCollege = async () => {
    if (!confirm(`Notifier le directeur et la secrétaire de ${collegeNom} que le brouillon du collège est prêt ?`)) return;
    setError('');
    setNotifyingCollege(true);
    try {
      await collegeAPI.notifierBrouillon(collegeId);
      flash('Notification envoyée au directeur et à la secrétaire');
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur lors de l\'envoi');
    } finally {
      setNotifyingCollege(false);
    }
  };
    const handleNotifyCartesCollege = async () => {
    const dateStr = prompt('Date et heure de passage (ex: 25/08/2026 14:30) :');
    if (!dateStr) return;

    const datePassage = parseDatePassage(dateStr);
    if (!datePassage) {
      setError('Format de date invalide. Utilisez JJ/MM/AAAA HH:MM');
      return;
    }

    if (!confirm(`Notifier le directeur et la secrétaire de ${collegeNom} que les cartes du collège sont prêtes (passage le ${dateStr}) ?`)) return;

    setError('');
    setNotifyingCartesCollege(true);
    try {
      await collegeAPI.notifierCartes(collegeId, { datePassage });
      flash('Notification "Cartes prêtes" envoyée au directeur et à la secrétaire');
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur lors de l\'envoi');
    } finally {
      setNotifyingCartesCollege(false);
    }
  };

  const q = search.trim().toLowerCase();
  const visibles = q ? classes.filter(c => (c.code || '').toLowerCase().includes(q)) : classes;

  return (
    <div>
      <div className="sticky top-[73px] z-10 -mx-6 px-6 py-3 bg-[#f7faf8] border-b border-slate-200 mb-5">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 mr-auto min-w-0">
            <School className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="text-sm font-semibold text-slate-800 truncate">{collegeNom}</span>
            <span className="text-xs text-slate-400 shrink-0">
              {classes.length} classe{classes.length > 1 ? 's' : ''}
            </span>
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher une classe"
              className="w-52 pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

                   <button
            onClick={handleCollegeBrouillon}
            disabled={generatingCollege || !classes.length}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 hover:border-slate-300 disabled:opacity-50 disabled:cursor-not-allowed text-slate-700 rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap"
          >
            <Download className="w-4 h-4" />
            {generatingCollege ? 'Génération...' : 'Brouillon du collège'}
          </button>

          <div className="relative" ref={notifMenuRef}>
            <button
              onClick={() => setShowNotifMenu(v => !v)}
              disabled={!classes.length}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 hover:border-emerald-300 disabled:opacity-50 text-slate-700 rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap"
            >
              <Bell className="w-4 h-4" />
              Notifications
              <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${showNotifMenu ? 'rotate-180' : ''}`} />
            </button>

            {showNotifMenu && (
              <div className="absolute left-0 top-11 w-64 bg-white border border-slate-200 rounded-xl shadow-lg z-50 overflow-hidden py-1.5">
                <button
                  onClick={() => { setShowNotifMenu(false); handleNotifyCollege(); }}
                  disabled={notifyingCollege}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50 cursor-pointer text-left"
                >
                  {notifyingCollege ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4 text-slate-400" />}
                  {notifyingCollege ? 'Envoi...' : 'Notifier brouillon prêt'}
                </button>
                <button
                  onClick={() => { setShowNotifMenu(false); handleNotifyCartesCollege(); }}
                  disabled={notifyingCartesCollege}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50 cursor-pointer text-left"
                >
                  {notifyingCartesCollege ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4 text-slate-400" />}
                  {notifyingCartesCollege ? 'Envoi...' : 'Cartes prêtes'}
                </button>
                <button
                  onClick={() => { setShowNotifMenu(false); handleResendManagementActivationEmails(); }}
                  disabled={creatingComptes}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50 cursor-pointer text-left"
                >
                  {creatingComptes ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4 text-slate-400" />}
                  {creatingComptes ? 'Envoi...' : 'Renvoyer lien activation'}
                </button>
              </div>
            )}
          </div>

          <button
            onClick={() => handleCreateComptes()}
            disabled={creatingComptes}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 hover:border-slate-300 disabled:opacity-50 text-slate-700 rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap"
          >
            {creatingComptes ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
            {creatingComptes ? 'Création...' : 'Créer comptes de gestion'}
          </button>

          <button
            onClick={showForm ? reset : openCreate}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            {showForm ? 'Fermer' : 'Créer une classe'}
          </button> 
        </div>
      </div>

      {error && <Notice onClose={() => setError('')}>{error}</Notice>}
      {notice && <Notice type="success" onClose={() => setNotice('')}>{notice}</Notice>}

      {showSecretaireModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <form onSubmit={submitSecretaireModal} className="bg-white rounded-xl p-6 max-w-md w-full">
            <h3 className="text-sm font-semibold text-slate-800 mb-1">Informations de la secrétaire</h3>
            <p className="text-xs text-slate-500 mb-4">
              Requises pour créer les deux comptes de gestion (directeur + secrétaire).
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
              <Input
                label="Prénom"
                required
                value={secretaireModalForm.secretaire_prenom}
                onChange={v => setSecretaireModalForm({ ...secretaireModalForm, secretaire_prenom: v })}
              />
              <Input
                label="Nom"
                required
                value={secretaireModalForm.secretaire_nom}
                onChange={v => setSecretaireModalForm({ ...secretaireModalForm, secretaire_nom: v })}
              />
              <Input
                label="Téléphone"
                value={secretaireModalForm.secretaire_telephone}
                onChange={v => setSecretaireModalForm({ ...secretaireModalForm, secretaire_telephone: v })}
              />
              <Input
                label="Email"
                type="email"
                required
                value={secretaireModalForm.secretaire_email}
                onChange={v => setSecretaireModalForm({ ...secretaireModalForm, secretaire_email: v })}
              />
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={creatingComptes}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white rounded-lg text-sm font-medium cursor-pointer"
              >
                {creatingComptes ? 'Création...' : 'Créer les comptes'}
              </button>
              <button
                type="button"
                onClick={() => setShowSecretaireModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium cursor-pointer"
              >
                Annuler
              </button>
            </div>
          </form>
        </div>
      )}

      {showForm && (
        <form onSubmit={submit} className="bg-white border border-emerald-200 rounded-xl p-5 mb-5">
          <h3 className="text-sm font-semibold text-slate-800 mb-4">
            {editingId ? 'Modifier la classe' : 'Nouvelle classe'}
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Classe</label>
              <input
                type="text"
                autoFocus
                placeholder="6ème, 3ème, Tle..."
                value={form.niveau}
                onChange={e => setForm({ ...form, niveau: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Série</label>
              <input
                type="text"
                placeholder="A, B, M2, D..."
                value={form.serie}
                onChange={e => setForm({ ...form, serie: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                required
              />
            </div>
          </div>

          {(form.niveau || form.serie) && (
            <p className="text-xs text-slate-500 mb-4">
              Sera enregistrée sous :{' '}
              <span className="font-medium text-slate-700">
                {form.niveau}-{form.serie.toUpperCase()}
              </span>
            </p>
          )}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white rounded-lg text-sm font-medium cursor-pointer"
            >
              {saving ? 'Enregistrement' : editingId ? 'Enregistrer' : 'Créer'}
            </button>
            <button
              type="button"
              onClick={reset}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium cursor-pointer"
            >
              Annuler
            </button>
          </div>
        </form>
      )}

      {!visibles.length ? (
        <Panel>
          <p className="text-sm text-slate-500">
            {q ? `Aucune classe ne correspond à « ${search} ».` : 'Aucune classe dans ce collège.'}
          </p>
        </Panel>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {visibles.map(cls => (
            <div
              key={cls.id}
              onClick={() => onOpen(cls)}
              className="bg-white border border-slate-200 hover:border-emerald-300 rounded-xl p-5 cursor-pointer transition group"
            >
              <div className="flex items-start justify-between mb-3">
                <span className="text-base font-semibold text-slate-800 group-hover:text-emerald-700 transition">
                  {cls.code}
                </span>
                <div className="flex gap-1">
                  <button
                    onClick={e => { e.stopPropagation(); openEdit(cls); }}
                    className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md cursor-pointer"
                    title="Modifier"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={e => { e.stopPropagation(); remove(cls); }}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md cursor-pointer"
                    title="Supprimer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <Users className="w-3.5 h-3.5" />
                {cls.effectif ?? 0} élèves
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ============== Panneau de classe ============== */

const CLASS_TABS = [
  { key: 'eleves', label: 'Élèves', icon: Users },
  { key: 'brouillon', label: 'Brouillon', icon: FileText },
  { key: 'cartes', label: 'Cartes finales', icon: CreditCard },
];

function ClassPanel({ cls, students, collegeInfo, onRefresh }) {
  const [tab, setTab] = useState('eleves');

  return (
    <div>
      <div className="sticky top-[73px] z-10 -mx-6 px-6 py-3 bg-[#f7faf8] border-b border-slate-200 mb-5">
        <div className="flex gap-1">
          {CLASS_TABS.map(t => {
            const Icon = t.icon;
            const on = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition cursor-pointer ${
                  on ? 'bg-emerald-50 text-emerald-700' : 'text-slate-500 hover:bg-slate-100'
                }`}
              >
                <Icon className="w-4 h-4" />
                {t.label}
                {t.key === 'eleves' && (
                  <span className="text-xs text-slate-400">({students.length})</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {tab === 'eleves' && (
        <ElevesSection classId={cls.id} students={students} onRefresh={onRefresh} />
      )}
      {tab === 'brouillon' && (
        <BrouillonSection cls={cls} students={students} collegeInfo={collegeInfo} onRefresh={onRefresh} />
      )}
      {tab === 'cartes' && (
        <CartesSection cls={cls} students={students} collegeInfo={collegeInfo} />
      )}
    </div>
  );
}

/* ---- Élèves ---- */

const emptyStudent = {
  matricule: '', nom: '', prenom: '', sexe: 'M',
  date_naissance: '', lieu_naissance: '', nationalite: 'BENINOISE', adresse: '',
};

const ELEVES_TABS = [
  { key: 'list', label: 'Liste', icon: Search },
  { key: 'manual', label: 'Ajouter', icon: Plus },
  { key: 'import', label: 'Import Excel', icon: FileSpreadsheet },
  { key: 'photos', label: 'Photos', icon: ImageIcon },
];

function ElevesSection({ classId, students, onRefresh }) {
  const [sub, setSub] = useState('list');
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [form, setForm] = useState(emptyStudent);
  const [photo, setPhoto] = useState(null);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const [excelFile, setExcelFile] = useState(null);
  const [validation, setValidation] = useState(null);
  const [busy, setBusy] = useState(false);
  const excelInputRef = useRef(null);

  const [photoFiles, setPhotoFiles] = useState([]);
  const [progress, setProgress] = useState(0);

  const flash = (msg) => { setNotice(msg); setTimeout(() => setNotice(''), 4000); };

  const visibles = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return students;
    return students.filter(s =>
      [s.matricule, s.nom, s.prenom].some(v => (v || '').toLowerCase().includes(q))
    );
  }, [students, search]);

  const resetForm = () => { setForm(emptyStudent); setPhoto(null); setEditingId(null); };

  const startEdit = (s) => {
    setForm({
      matricule: s.matricule,
      nom: s.nom || '',
      prenom: s.prenom || '',
      sexe: s.sexe || 'M',
      date_naissance: s.date_naissance || '',
      lieu_naissance: s.lieu_naissance || '',
      nationalite: s.nationalite || '',
      adresse: s.adresse || '',
    });
    setEditingId(s.id);
    setPhoto(null);
    setSub('manual');
  };

  const submitStudent = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      if (editingId) {
        await studentAPI.update(editingId, form);
        if (photo) await studentAPI.updatePhoto(editingId, photo);
        flash('Élève mis à jour');
      } else {
        await studentAPI.create(classId, form, photo);
        flash('Élève ajouté');
      }
      resetForm();
      await onRefresh();
      setSub('list');
    } catch (err) {
      setError(err.response?.data?.error || "Erreur lors de l'enregistrement");
    } finally {
      setSaving(false);
    }
  };

  const removeStudent = async (s) => {
    if (!confirm(`Supprimer ${s.nom} ${s.prenom} (${s.matricule}) ?`)) return;
    try {
      await studentAPI.delete(s.id);
      await onRefresh();
      flash('Élève supprimé');
    } catch {
      setError('Erreur lors de la suppression');
    }
  };

  const downloadTemplate = async () => {
    try {
      const res = await importAPI.downloadTemplate();
      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = 'template_eleves.xlsx';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError('Erreur lors du téléchargement du template');
    }
  };

  const handleExcelChange = (e) => {
    const file = e.target.files[0] || null;
    setExcelFile(file);
    setValidation(null);
    setError('');
    e.target.value = '';
  };

  const cancelImport = () => {
    setExcelFile(null);
    setValidation(null);
    setError('');
    if (excelInputRef.current) excelInputRef.current.value = '';
  };

  const validateExcel = async () => {
    if (!excelFile) return;
    setError('');
    setBusy(true);
    try {
      const res = await importAPI.validateExcel(excelFile);
      setValidation(res.data);
      if (!res.data.valid) setError(`${res.data.errors.length} erreur(s) détectée(s)`);
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur lors de la validation');
    } finally {
      setBusy(false);
    }
  };

  const runImport = async () => {
    if (!validation?.data?.length) return;
    setBusy(true);
    try {
      const res = await importAPI.importStudents(classId, validation.data);
      flash(`${res.data.imported} élève(s) importé(s)`);
      if (res.data.errors?.length) setError(res.data.errors.join(' · '));
      cancelImport();
      await onRefresh();
      setSub('list');
    } catch (err) {
      setError(err.response?.data?.error || "Erreur lors de l'import");
    } finally {
      setBusy(false);
    }
  };

  const uploadPhotos = async () => {
    if (!photoFiles.length) return;
    setBusy(true);
    setError('');
    let ok = 0;
    const orphelins = [];

    for (let i = 0; i < photoFiles.length; i++) {
      const file = photoFiles[i];
      const mat = file.name.replace(/\.[^.]+$/, '').trim().toUpperCase();
      const student = students.find(s => (s.matricule || '').toUpperCase() === mat);

      if (!student) { orphelins.push(file.name); }
      else {
        try {
          await studentAPI.updatePhoto(student.id, file);
          ok++;
        } catch {
          orphelins.push(file.name);
        }
      }
      setProgress(Math.round(((i + 1) / photoFiles.length) * 100));
    }

    flash(`${ok} photo(s) associée(s)`);
    if (orphelins.length) setError(`Sans correspondance : ${orphelins.join(', ')}`);
    setPhotoFiles([]);
    setProgress(0);
    setBusy(false);
    await onRefresh();
  };

  return (
    <div>
      <div className="flex gap-1 mb-5 border-b border-slate-200">
        {ELEVES_TABS.map(t => {
          const Icon = t.icon;
          const on = sub === t.key;
          return (
            <button
              key={t.key}
              onClick={() => { setSub(t.key); setError(''); if (t.key !== 'manual') resetForm(); }}
              className={`flex items-center gap-2 px-3 py-2.5 text-sm font-medium border-b-2 transition cursor-pointer ${
                on ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      {error && <Notice onClose={() => setError('')}>{error}</Notice>}
      {notice && <Notice type="success">{notice}</Notice>}

      {sub === 'list' && (
        <>
          <div className="flex items-center gap-3 mb-4">
            <div className="relative mr-auto">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Matricule, nom, prénom"
                className="w-64 pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <button
              onClick={() => { resetForm(); setSub('manual'); }}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Ajouter un élève
            </button>
          </div>

          {!visibles.length ? (
            <Panel><p className="text-sm text-slate-500">{search ? 'Aucun résultat.' : 'Aucun élève dans cette classe.'}</p></Panel>
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr className="text-left text-xs font-medium text-slate-500">
                    <th className="px-4 py-3">Matricule</th>
                    <th className="px-4 py-3">Nom</th>
                    <th className="px-4 py-3">Prénom(s)</th>
                    <th className="px-4 py-3">Sexe</th>
                    <th className="px-4 py-3">Date et lieu de naissance</th>
                    <th className="px-4 py-3">Contact parent</th>
                    <th className="px-4 py-3">Photo</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visibles.map(s => (
                    <tr key={s.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60">
                      <td className="px-4 py-3 font-medium text-slate-800">{s.matricule}</td>
                      <td className="px-4 py-3 text-slate-700">{s.nom}</td>
                      <td className="px-4 py-3 text-slate-700">{s.prenom}</td>
                      <td className="px-4 py-3 text-slate-600">{s.sexe}</td>
                      <td className="px-4 py-3 text-slate-600">
                        {formatDateFr(s.date_naissance) || '—'}{s.lieu_naissance ? ` · ${s.lieu_naissance}` : ''}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{s.adresse || '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                          s.photo_path ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                        }`}>
                          {s.photo_path ? 'OK' : 'Manquante'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <button onClick={() => startEdit(s)} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md cursor-pointer" title="Modifier">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => removeStudent(s)} className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md cursor-pointer" title="Supprimer">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {sub === 'manual' && (
        <form onSubmit={submitStudent} className="bg-white border border-slate-200 rounded-xl p-6 max-w-3xl">
          <h3 className="text-sm font-semibold text-slate-800 mb-5">
            {editingId ? "Modifier l'élève" : 'Nouvel élève'}
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
            <Input label="Matricule" required disabled={!!editingId} value={form.matricule}
              onChange={v => setForm({ ...form, matricule: v })} placeholder="MAT001" />
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Sexe</label>
              <select
                value={form.sexe}
                onChange={e => setForm({ ...form, sexe: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
              >
                <option value="M">M</option>
                <option value="F">F</option>
              </select>
            </div>
            <Input label="Nom" required value={form.nom} onChange={v => setForm({ ...form, nom: v })} placeholder="HOUNDNJE" />
            <Input label="Prénom(s)" required value={form.prenom} onChange={v => setForm({ ...form, prenom: v })} placeholder="Oswell Séwanu" />
            <Input label="Date de naissance" type="date" value={form.date_naissance} onChange={v => setForm({ ...form, date_naissance: v })} />
            <Input label="Lieu de naissance" value={form.lieu_naissance} onChange={v => setForm({ ...form, lieu_naissance: v })} placeholder="Cotonou" />
            <Input label="Nationalité" value={form.nationalite} onChange={v => setForm({ ...form, nationalite: v })} placeholder="BENINOISE" />
            <Input label="Contact parent" value={form.adresse} onChange={v => setForm({ ...form, adresse: v })} placeholder="95961070" />
          </div>

          <div className="mb-5">
            <label className="block text-xs font-medium text-slate-600 mb-1.5">
              Photo {editingId ? '(laisser vide pour conserver)' : '(optionnel)'}
            </label>
            <input
              type="file"
              accept="image/png,image/jpeg"
              onChange={e => setPhoto(e.target.files[0] || null)}
              className="block w-full text-sm text-slate-600 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200 file:cursor-pointer"
            />
          </div>

          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white rounded-lg text-sm font-medium cursor-pointer">
              {saving ? 'Enregistrement' : editingId ? 'Enregistrer' : 'Ajouter'}
            </button>
            <button type="button" onClick={() => { resetForm(); setSub('list'); }} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium cursor-pointer">
              Annuler
            </button>
          </div>
        </form>
      )}

      {sub === 'import' && (
        <div className="max-w-3xl space-y-4">
          <Card>
            <p className="text-sm text-slate-700 mb-1 font-medium">1. Télécharger le modèle</p>
            <p className="text-xs text-slate-500 mb-4">
              Huit colonnes : matricule, nom, prénom, sexe, date de naissance, lieu, nationalité, contact parent.
            </p>
            <button onClick={downloadTemplate} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 hover:border-slate-300 text-slate-700 rounded-lg text-sm font-medium cursor-pointer">
              <Download className="w-4 h-4" />
              Template Excel
            </button>
          </Card>

          <Card>
            <p className="text-sm text-slate-700 mb-4 font-medium">2. Charger le fichier rempli</p>
            <input
              ref={excelInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleExcelChange}
              className="block w-full text-sm text-slate-600 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200 file:cursor-pointer"
            />
            {excelFile && (
              <>
                <p className="text-xs text-slate-500 mt-2">Fichier sélectionné : {excelFile.name}</p>
                <div className="flex gap-2 mt-4">
                  <button onClick={validateExcel} disabled={busy} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white rounded-lg text-sm font-medium cursor-pointer">
                    {busy ? 'Vérification' : 'Vérifier le fichier'}
                  </button>
                  <button type="button" onClick={cancelImport} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium cursor-pointer">
                    Annuler
                  </button>
                </div>
              </>
            )}
          </Card>

          {validation && (
            <Card>
              <p className="text-sm text-slate-700 mb-3 font-medium">3. Importer</p>
              <p className="text-sm text-slate-600 mb-3">
                {validation.totalRows} ligne(s) valide(s){validation.errors?.length ? `, ${validation.errors.length} erreur(s)` : ''}
              </p>
              {validation.errors?.length > 0 && (
                <ul className="mb-4 max-h-40 overflow-y-auto text-xs text-rose-600 space-y-1">
                  {validation.errors.map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              )}
              <div className="flex gap-2">
                <button onClick={runImport} disabled={busy || !validation.data?.length} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white rounded-lg text-sm font-medium cursor-pointer">
                  <Upload className="w-4 h-4" />
                  {busy ? 'Import en cours' : `Importer ${validation.data?.length || 0} élève(s)`}
                </button>
                <button type="button" onClick={cancelImport} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium cursor-pointer">
                  Annuler
                </button>
              </div>
            </Card>
          )}
        </div>
      )}

      {sub === 'photos' && (
        <div className="max-w-3xl space-y-4">
          <Card>
            <p className="text-sm text-slate-700 mb-1 font-medium">Nommer les fichiers</p>
            <p className="text-xs text-slate-500 mb-4">
              Chaque photo doit porter le matricule de l'élève comme nom de fichier : MAT001.jpg, MAT002.jpg.
              L'association est automatique. Sélectionnez le dossier entier d'un coup.
            </p>
            <input
              type="file"
              multiple
              accept="image/png,image/jpeg"
              onChange={e => setPhotoFiles(Array.from(e.target.files))}
              className="block w-full text-sm text-slate-600 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200 file:cursor-pointer"
            />
          </Card>

          {photoFiles.length > 0 && (
            <Card>
              <p className="text-sm text-slate-700 mb-3 font-medium">{photoFiles.length} fichier(s) sélectionné(s)</p>
              {progress > 0 && (
                <div className="mb-4">
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 transition-all" style={{ width: `${progress}%` }} />
                  </div>
                  <p className="text-xs text-slate-500 mt-1">{progress}%</p>
                </div>
              )}
              <button onClick={uploadPhotos} disabled={busy} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white rounded-lg text-sm font-medium cursor-pointer">
                <Upload className="w-4 h-4" />
                {busy ? 'Envoi en cours' : 'Associer les photos'}
              </button>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

function Input({ label, value, onChange, type = 'text', placeholder, required, disabled }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1.5">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:text-slate-400"
      />
    </div>
  );
}

function Card({ children }) {
  return <div className="bg-white border border-slate-200 rounded-xl p-5">{children}</div>;
}

/* ---- Brouillon (liste) ---- */

function BrouillonSection({ cls, students, collegeInfo, onRefresh }) {
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [editingStudent, setEditingStudent] = useState(null);
  const [editData, setEditData] = useState({});
  const [generating, setGenerating] = useState(false);
  const [notifying, setNotifying] = useState(false);

  const flash = (msg) => { setNotice(msg); setTimeout(() => setNotice(''), 4000); };

  const startEdit = (s) => {
    setEditingStudent(s.id);
    setEditData({
      nom: s.nom, prenom: s.prenom, sexe: s.sexe, date_naissance: s.date_naissance || '',
      lieu_naissance: s.lieu_naissance || '', nationalite: s.nationalite || '', adresse: s.adresse || '',
    });
  };

  const saveEdit = async () => {
    try {
      await studentAPI.update(editingStudent, editData);
      setEditingStudent(null);
      await onRefresh();
      flash('Élève mis à jour');
    } catch {
      setError('Erreur lors de la sauvegarde');
    }
  };

  const changePhoto = async (studentId, file) => {
    if (!file) return;
    try {
      await studentAPI.updatePhoto(studentId, file);
      await onRefresh();
      flash('Photo mise à jour');
    } catch {
      setError('Erreur lors de la mise à jour de la photo');
    }
  };

  const exportPDF = async () => {
    setError('');
    setGenerating(true);
    try {
      await generateBrouillonPDF(students, cls, collegeInfo);
      flash('PDF généré et téléchargé');
    } catch {
      setError('Erreur lors de la génération du PDF');
    } finally {
      setGenerating(false);
    }
  };
    const notifyReady = async () => {
    if (!confirm('Envoyer une notification "brouillon prêt" au directeur et à la secrétaire ?')) return;
    setError('');
    setNotifying(true);
    try {
      await collegeAPI.notifierBrouillon(collegeInfo.id, cls.id);
      flash('Notification envoyée au directeur et à la secrétaire');
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur lors de l\'envoi de la notification');
    } finally {
      setNotifying(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-slate-500">{students.length} élève{students.length > 1 ? 's' : ''}</p>
        <div className="flex gap-2">
          <button
            onClick={exportPDF}
            disabled={generating || !students.length}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white rounded-lg text-sm font-medium cursor-pointer"
          >
            <Download className="w-4 h-4" />
            {generating ? 'Génération' : 'Exporter PDF (A4 paysage)'}
          </button>
          <button
            onClick={notifyReady}
            disabled={notifying || !students.length}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 hover:border-emerald-300 disabled:opacity-50 text-slate-700 rounded-lg text-sm font-medium cursor-pointer"
            title="Notifier le directeur et la secrétaire que le brouillon est prêt"
          >
            {notifying
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <Send className="w-4 h-4" />}
            {notifying ? 'Envoi...' : 'Notifier'}
          </button>
        </div>
      </div>

      {error && <Notice onClose={() => setError('')}>{error}</Notice>}
      {notice && <Notice type="success">{notice}</Notice>}

      <div className="flex gap-6">
        <div className="flex-1">
          {!students.length ? (
            <Panel><p className="text-sm text-slate-500">Aucun élève dans cette classe.</p></Panel>
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
              {students.map(s => (
                <div key={s.id} className="flex items-center gap-4 p-4">
                  <label className="w-14 h-14 rounded-lg bg-slate-100 flex items-center justify-center shrink-0 overflow-hidden cursor-pointer relative group">
                    {s.photo_path ? (
                      <img src={photoUrl(s.photo_path)} alt={s.nom} className="w-full h-full object-cover" />
                    ) : (
                      <ImageIcon className="w-5 h-5 text-slate-300" />
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={e => changePhoto(s.id, e.target.files[0])}
                      className="hidden"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition flex items-center justify-center">
                      <span className="text-[10px] text-white opacity-0 group-hover:opacity-100">Changer</span>
                    </div>
                  </label>

                  <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1 text-sm">
                    <div><span className="text-xs text-slate-400">Matricule</span><div className="text-slate-800 font-medium">{s.matricule}</div></div>
                    <div><span className="text-xs text-slate-400">Nom</span><div className="text-slate-700">{s.nom}</div></div>
                    <div><span className="text-xs text-slate-400">Prénom</span><div className="text-slate-700">{s.prenom}</div></div>
                    <div><span className="text-xs text-slate-400">Sexe</span><div className="text-slate-700">{s.sexe}</div></div>
                    <div><span className="text-xs text-slate-400">Date et lieu de naissance</span><div className="text-slate-700">{formatDateFr(s.date_naissance) || '—'} {s.lieu_naissance ? `· ${s.lieu_naissance}` : ''}</div></div>
                    <div><span className="text-xs text-slate-400">Nationalité</span><div className="text-slate-700">{s.nationalite || '—'}</div></div>
                    <div className="col-span-2"><span className="text-xs text-slate-400">Contact parent</span><div className="text-slate-700">{s.adresse || '—'}</div></div>
                  </div>

                  <button
                    onClick={() => startEdit(s)}
                    className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md cursor-pointer shrink-0"
                    title="Modifier"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="w-80 hidden lg:block">
          <ObservationsPanel classId={cls.id} currentUserId={null} />
        </div>
      </div>

      {editingStudent && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 max-w-lg w-full">
            <h3 className="text-sm font-semibold text-slate-800 mb-4">Modifier l'élève</h3>
            <div className="grid grid-cols-2 gap-3 mb-5">
              <Input label="Nom" value={editData.nom} onChange={v => setEditData({ ...editData, nom: v })} />
              <Input label="Prénom" value={editData.prenom} onChange={v => setEditData({ ...editData, prenom: v })} />
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Sexe</label>
                <select value={editData.sexe} onChange={e => setEditData({ ...editData, sexe: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm cursor-pointer">
                  <option value="M">M</option>
                  <option value="F">F</option>
                </select>
              </div>
              <Input label="Date de naissance" type="date" value={editData.date_naissance} onChange={v => setEditData({ ...editData, date_naissance: v })} />
              <Input label="Lieu de naissance" value={editData.lieu_naissance} onChange={v => setEditData({ ...editData, lieu_naissance: v })} />
              <Input label="Nationalité" value={editData.nationalite} onChange={v => setEditData({ ...editData, nationalite: v })} />
              <div className="col-span-2">
                <Input label="Contact parent" value={editData.adresse} onChange={v => setEditData({ ...editData, adresse: v })} />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={saveEdit} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium cursor-pointer">
                Enregistrer
              </button>
              <button onClick={() => setEditingStudent(null)} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium cursor-pointer">
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================================================================
   CARTES FINALES
   ========================================================================== */

/* --- Aperçu HTML : reproduit fidèlement le rendu PDF --- */

const PREVIEW_W = 342;                      // largeur d'aperçu en px
const BASE_PT = 242.6;                      // largeur de référence du design (pt)
const S = PREVIEW_W / BASE_PT;              // facteur d'échelle
const u = (n) => n * S;
const PREVIEW_H = PREVIEW_W * (53.98 / 85.6);

const formatSexe = (s) => {
  const v = (s || '').toString().trim().toUpperCase();
  if (v === 'F' || v.startsWith('FEM')) return 'Féminin';
  if (v === 'M' || v.startsWith('MAS')) return 'Masculin';
  return s || '';
};

// L'API renvoie la date au format YYYY-MM-DD -> affichage jj/mm/aaaa sur la carte
const formatDateFr = (value) => {
  if (!value) return '';
  const str = value.toString().trim();
  const m = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  return str;
};

function Tricolor({ left, top, width, height }) {
  const seg = width / 3;
  return (
    <div style={{ position: 'absolute', left, top, width, height, display: 'flex' }}>
      <div style={{ width: seg, background: '#00873E' }} />
      <div style={{ width: seg, background: '#FCD900' }} />
      <div style={{ width: seg, background: '#E31C24' }} />
    </div>
  );
}

function RectoPreview({ student, cls, college, year }) {
  const logoW = u(130);
  const logoH = logoW * 0.214;
  const P = u(5);
  const labelSize = u(8);
  const lineH = u(12); // taille 8 x interligne 1.5

  const rows = [
    ['Nom :', student?.nom || ''],
    ['Prénom(s) :', student?.prenom || ''],
    ['Né(e) le :', `${formatDateFr(student?.date_naissance)}${student?.lieu_naissance ? `   à   ${student.lieu_naissance}` : ''}`],
    ['Sexe :', formatSexe(student?.sexe)],
    ['Nationalité :', student?.nationalite || ''],
    ['Adresse :', student?.adresse || ''],
    ['Classe :', cls?.code || ''],
  ];

  // ---- Repartition de la hauteur du logo entre nom / slogan / adresse
  // (miroir exact de la logique de drawRecto dans pdfUtils.js)
  const headerBoxW = PREVIEW_W - (P + logoW + u(4)) - u(5);
  const nomText = (college?.nom || '').toUpperCase();
  const hasSlogan = !!college?.slogan;
  const adresseLigne = [college?.adresse_postale, college?.commune].filter(Boolean).join('   ');
  const hasAddr = !!(college?.adresse_postale || college?.commune);

  const NAME_MAX = u(7);
  const NAME_MIN = u(5);
  const SMALL_MAX = u(5.5);
  const SMALL_MIN = u(4);

  let nameLinesCount = 1;
  let totalRows = nameLinesCount + (hasSlogan ? 1 : 0) + (hasAddr ? 1 : 0);
  let rowH = logoH / totalRows;
  let nameSize = Math.max(Math.min(NAME_MAX, rowH / 1.15), NAME_MIN);
  const fitsOneLine = previewMeasurer.widthOfTextAtSize(nomText, nameSize) <= headerBoxW;

  let nameLines;
  if (fitsOneLine) {
    nameLines = [nomText];
  } else {
    nameLinesCount = 2;
    totalRows = nameLinesCount + (hasSlogan ? 1 : 0) + (hasAddr ? 1 : 0);
    rowH = logoH / totalRows;
    nameSize = Math.max(Math.min(NAME_MAX, rowH / 1.15), NAME_MIN);
    nameLines = wrapText(previewMeasurer, nomText, nameSize, headerBoxW, 2);
  }
  const sloganSize = hasSlogan ? Math.max(Math.min(SMALL_MAX, rowH / 1.15), SMALL_MIN) : 0;
  const addrSize = hasAddr ? Math.max(Math.min(SMALL_MAX, rowH / 1.15), SMALL_MIN) : 0;

  // ---- Empilement top-down (le haut de la 1ere ligne s'aligne sur le haut du logo)
  let topCursor = P;
  const nameBlocks = nameLines.map((line) => {
    const t = topCursor;
    topCursor += nameSize * 1.15;
    return { line, top: t };
  });
  const sloganTop = hasSlogan ? topCursor : null;
  if (hasSlogan) topCursor += sloganSize * 1.15;
  const adresseTop = hasAddr ? topCursor : null;

  // ---- Titre : position fixe, toujours calee sur la hauteur du logo
  const titleTop = P + logoH + u(11);

  const titleBlockH = u(10) * 1.25; // hauteur visuelle du titre (police 10, line-height ~1.25)
  const rowsTop = titleTop + titleBlockH + u(2);
  const photoTop = rowsTop;
  const photoH = rows.length * lineH; // ici pas d'approximation necessaire : chaque ligne CSS a une hauteur de boite fixe
  const photoW = photoH * (35 / 45);

  const sigW = u(54);
  const sigH = u(19);

  return (
    <div
      style={{
        position: 'relative', width: PREVIEW_W, height: PREVIEW_H,
        background: '#fff', border: '1px solid #cbd5e1', overflow: 'hidden',
        fontFamily: 'Arial, Helvetica, sans-serif', color: '#000',
      }}
    >
      <img src="/logo.png" alt="" style={{ position: 'absolute', left: P, top: P, width: logoW }} />

      <div style={{ position: 'absolute', left: P + logoW + u(4), width: headerBoxW, textAlign: 'center' }}>
        {nameBlocks.map(({ line, top }, i) => (
          <div key={i} style={{ position: 'absolute', left: 0, width: '100%', top, fontSize: nameSize, fontWeight: 700 }}>
            {line}
          </div>
        ))}
        {sloganTop !== null && (
          <div style={{ position: 'absolute', left: 0, width: '100%', top: sloganTop, fontSize: sloganSize, fontStyle: 'italic' }}>
            {college.slogan}
          </div>
        )}
        {adresseTop !== null && (
          college?.adresse_postale ? (
            <div style={{ position: 'absolute', left: 0, width: '100%', top: adresseTop, fontSize: addrSize }}>
              <span style={{ marginRight: u(2) }}>✉</span>{adresseLigne}
            </div>
          ) : (
            <div style={{ position: 'absolute', left: 0, width: '100%', top: adresseTop, fontSize: addrSize }}>
              {college.commune}
            </div>
          )
        )}
      </div>

      <div style={{
        position: 'absolute', left: 0, top: titleTop, width: PREVIEW_W,
        textAlign: 'center', fontSize: u(10), fontWeight: 700, letterSpacing: 0.2,
      }}>
        CARTE D'IDENTITE SCOLAIRE&nbsp;&nbsp;&nbsp;{year}
      </div>

      <div style={{
        position: 'absolute', left: u(8), top: photoTop,
        width: photoW, height: photoH, background: '#141414', overflow: 'hidden',
      }}>
        {student?.photo_path && (
          <img src={photoUrl(student.photo_path)} alt=""
            style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
        )}
      </div>
      <div style={{
        position: 'absolute', left: u(8), top: photoTop + photoH + u(2),
        width: photoW, textAlign: 'center', fontSize: u(7), fontWeight: 700,
      }}>
        Mle : {student?.matricule || ''}
      </div>

      <div style={{ position: 'absolute', left: u(8) + photoW + u(9), top: rowsTop, right: u(5) }}>
        {rows.map(([label, value]) => (
          <div key={label} style={{ height: lineH, fontSize: labelSize, whiteSpace: 'nowrap', overflow: 'hidden' }}>
            <span style={{ textDecoration: 'underline' }}>{label}</span>
            <span style={{ fontWeight: 700, marginLeft: u(6) }}>{value}</span>
          </div>
        ))}
      </div>

      <Tricolor left={(PREVIEW_W - u(85)) / 2} top={PREVIEW_H - u(8) - u(4.5)} width={u(85)} height={u(4.5)} />

      <div style={{
        position: 'absolute', right: u(5), top: PREVIEW_H - u(15) - sigH,
        width: sigW, height: sigH, border: '1px solid #333',
      }} />
      <div style={{
        position: 'absolute', right: u(5), top: PREVIEW_H - u(13),
        width: sigW, textAlign: 'center', fontSize: u(4.2), fontStyle: 'italic', color: '#737373',
      }}>
        Signature de l'apprenant
      </div>
    </div>
  );
}

// Mesure de texte pour calibrer dynamiquement la police du nom de l'établissement
// dans l'aperçu (canvas caché, réutilisé entre les rendus).
let _measureCanvas = null;
const measureTextPx = (text, sizePx, weight = 'bold') => {
  if (!_measureCanvas) _measureCanvas = document.createElement('canvas');
  const c = _measureCanvas.getContext('2d');
  c.font = `${weight} ${sizePx}px Arial, Helvetica, sans-serif`;
  return c.measureText(text || '').width;
};
const previewMeasurer = { widthOfTextAtSize: (t, sz) => measureTextPx(t, sz, 'bold') };
const fitWrappedText = (measurer, text, maxWidth, maxLines, maxSize, minSize) => {
  let size = maxSize;
  while (size > minSize) {
    const lines = wrapText(measurer, text, size, maxWidth, maxLines);
    if (!lines.some((l) => l.endsWith('...'))) return { lines, size };
    size -= 0.5;
  }
  return { lines: wrapText(measurer, text, minSize, maxWidth, maxLines), size: minSize };
};
function VersoPreview({ college, year, qrDataUrl }) {
  const nameText = (college?.nom || '').toUpperCase();
  const P = u(6);
  const NAME_MIN = u(8);
  const NAME_MAX = u(15);
  const nameMaxWidth = PREVIEW_W - P * 2;
  const fit = fitTitleSize(
    (t, sz) => measureTextPx(t, sz, 'bold'),
    nameText, PREVIEW_W * 0.7, nameMaxWidth, NAME_MIN, NAME_MAX
  );
  const nameLines = fit.fits ? [nameText] : wrapText(previewMeasurer, nameText, fit.size, nameMaxWidth, 2);

  let cursor = u(6);
  nameLines.forEach(() => { cursor += fit.size * 1.25; });
  cursor += u(3);
  if (college?.telephone) cursor += u(11);
  cursor += u(16);

  const labelTop = cursor;
  const rightX = PREVIEW_W * 0.42;
  const rightW = PREVIEW_W * 0.58 - u(6);
  const sigBoxW = u(72);
  const sigX = rightX + (rightW - sigBoxW) / 2;
  const sigAreaTop = labelTop + u(9);
  const sigBoxH = u(24);
  const nameTop = sigAreaTop + sigBoxH + u(5);
  const bandW = u(85);
  const bandTop = PREVIEW_H - u(12.5);
  const qrSize = u(28);

  return (
    <div
      style={{
        position: 'relative', width: PREVIEW_W, height: PREVIEW_H,
        background: '#fff', border: '1px solid #cbd5e1', overflow: 'hidden',
        fontFamily: 'Arial, Helvetica, sans-serif', color: '#000',
      }}
    >
      <div style={{ position: 'absolute', left: 0, top: u(6), width: PREVIEW_W, textAlign: 'center' }}>
        {nameLines.map((line, i) => (
          <div key={i} style={{ fontSize: fit.size, fontWeight: 700, lineHeight: 1.2 }}>{line}</div>
        ))}
        {college?.telephone && (
          <div style={{ fontSize: u(6.5), marginTop: u(4) }}>
            TEL : {college.telephone}
          </div>
        )}
        <div style={{ fontSize: u(6.5), fontWeight: 700, marginTop: u(4) }}>
          CARTE D'IDENTITE SCOLAIRE : {year}
        </div>
      </div>

      <div style={{
        position: 'absolute', left: rightX, top: labelTop, width: rightW,
        textAlign: 'center', fontSize: u(6), fontWeight: 700,
      }}>
        LE DIRECTEUR
      </div>

      {/* Zone vierge réservée à la signature manuscrite ou à l'image uploadée */}
      <div style={{
        position: 'absolute', left: sigX, top: sigAreaTop, width: sigBoxW, height: sigBoxH,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {college?.signature_path && (
          <img src={signatureUrl(college.signature_path)} alt=""
            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
        )}
      </div>

      {(college?.directeur_prenom || college?.directeur_nom) && (
        <div style={{
          position: 'absolute', left: rightX, top: nameTop, width: rightW,
          textAlign: 'center', fontSize: u(6.5), fontWeight: 700,
        }}>
          <span style={{ borderBottom: '1px solid #000', paddingBottom: u(1) }}>
            {`${college?.directeur_prenom || ''} ${college?.directeur_nom || ''}`.trim()}
          </span>
        </div>
      )}

      <Tricolor left={(PREVIEW_W - bandW) / 2} top={bandTop} width={bandW} height={u(4.5)} />

      <div style={{
        position: 'absolute', left: u(14), top: (PREVIEW_H - qrSize) / 2 + u(6),
        width: qrSize, height: qrSize, border: qrDataUrl ? 'none' : '1px solid #000',
      }}>
        {qrDataUrl && <img src={qrDataUrl} alt="QR" style={{ width: '100%', height: '100%' }} />}
      </div>
    </div>
  );
}

/* --- Section --- */

function CartesSection({ cls, students, collegeInfo }) {
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState(null);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState([]);

  const [cardW, setCardW] = useState(DEFAULT_CARD_MM.width);
  const [cardH, setCardH] = useState(DEFAULT_CARD_MM.height);
  const [includeVerso, setIncludeVerso] = useState(true);
  const [cropMarks, setCropMarks] = useState(true);

  const year = getSchoolYear();
  const flash = (msg) => { setNotice(msg); setTimeout(() => setNotice(''), 4000); };
  const [showNotifCartes, setShowNotifCartes] = useState(false);
  const [datePassage, setDatePassage] = useState('');
  const notifierCartes = async () => {
  if (!datePassage) {
    setError('Merci de renseigner la date de passage');
    return;
  }
  await run('notif-cartes', async () => {
    await collegeAPI.notifierCartes(collegeInfo.id, {
      classeId: cls.id,
      datePassage: new Date(datePassage).toISOString(),
    });
    setShowNotifCartes(false);
    setDatePassage('');
  }, 'Notification "Cartes prêtes" envoyée');
};
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const QRCode = (await import('qrcode')).default;
        const { buildQrPayload } = await import('../utils/pdfUtils');
        const url = await QRCode.toDataURL(buildQrPayload(collegeInfo), { margin: 0, width: 300 });
        if (alive) setQrDataUrl(url);
      } catch {
        if (alive) setQrDataUrl(null);
      }
    })();
    return () => { alive = false; };
  }, [collegeInfo]);

  const visibles = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return students;
    return students.filter(s =>
      [s.matricule, s.nom, s.prenom].some(v => (v || '').toLowerCase().includes(q))
    );
  }, [students, search]);

  const target = selected.length
    ? students.filter(s => selected.includes(s.id))
    : students;

  const opts = {
    cardWidthMm: Number(cardW) || DEFAULT_CARD_MM.width,
    cardHeightMm: Number(cardH) || DEFAULT_CARD_MM.height,
    includeVerso,
    cropMarks,
  };

  const run = async (key, fn, okMsg) => {
    setError('');
    setBusy(key);
    try {
      await fn();
      if (okMsg) flash(okMsg);
    } catch (e) {
      console.error(e);
      setError("Erreur lors de l'opération. Vérifiez que /logo.png existe dans le dossier public.");
    } finally {
      setBusy('');
    }
  };

  const toggle = (id) =>
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const avecPhoto = students.filter(s => s.photo_path).length;
  const pages = Math.ceil(target.length / 8) || 0;

  return (
    <div>
      {error && <Notice onClose={() => setError('')}>{error}</Notice>}
      {notice && <Notice type="success">{notice}</Notice>}

      {/* Barre d'actions */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 mb-5">
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="text-sm text-slate-700 mr-auto">
            <span className="font-medium">{target.length}</span> carte{target.length > 1 ? 's' : ''} à produire
            {selected.length > 0 && <span className="text-emerald-700"> (sélection)</span>}
            <span className="text-slate-400"> · {pages} page{pages > 1 ? 's' : ''} A4 · année {year}</span>
          </div>
          <button
            onClick={() => setShowNotifCartes(v => !v)}
            className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 hover:border-slate-300 text-slate-700 rounded-lg text-sm font-medium cursor-pointer"
          >
            <Bell className="w-4 h-4" />
            Cartes prêtes
          </button>
          <button
            onClick={() => setShowSettings(v => !v)}
            className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 hover:border-slate-300 text-slate-700 rounded-lg text-sm font-medium cursor-pointer"
          >
            <Settings2 className="w-4 h-4" />
            Format
          </button>
        </div>

        {showSettings && (
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-5 p-4 bg-slate-50 border border-slate-200 rounded-lg">
            <Input label="Largeur carte (mm)" type="number" value={cardW} onChange={setCardW} />
            <Input label="Hauteur carte (mm)" type="number" value={cardH} onChange={setCardH} />
            <div className="flex flex-col justify-end gap-2 text-sm text-slate-700">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={includeVerso} onChange={e => setIncludeVerso(e.target.checked)} />
                Inclure le verso
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={cropMarks} onChange={e => setCropMarks(e.target.checked)} />
                Repères de découpe
              </label>
            </div>
            <div className="flex items-end">
              <button
                onClick={() => { setCardW(DEFAULT_CARD_MM.width); setCardH(DEFAULT_CARD_MM.height); }}
                className="px-3 py-2 bg-white border border-slate-200 hover:border-slate-300 text-slate-700 rounded-lg text-xs font-medium cursor-pointer"
              >
                Réinitialiser (ISO ID-1)
              </button>
            </div>
          </div>
        )}
        {showNotifCartes && (
  <div className="mb-5 p-4 bg-slate-50 border border-slate-200 rounded-lg">
    <p className="text-sm font-medium text-slate-800 mb-3">
      Notifier "Cartes prêtes" pour la classe {cls.code}
    </p>
    <div className="flex flex-wrap items-end gap-3">
      <div>
        <label className="block text-xs text-slate-500 mb-1">Date et heure de passage</label>
        <input
          type="datetime-local"
          value={datePassage}
          onChange={e => setDatePassage(e.target.value)}
          className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
      </div>
      <button
        onClick={notifierCartes}
        disabled={!!busy}
        className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white rounded-lg text-sm font-medium cursor-pointer"
      >
        {busy === 'notif-cartes' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bell className="w-4 h-4" />}
        Envoyer
      </button>
    </div>
  </div>
)}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            onClick={() => run('a4', () => generateFinalCardsPDF(target, cls, collegeInfo, { ...opts, layout: 'a4' }), 'PDF A4 généré')}
            disabled={!!busy || !target.length}
            className="flex items-center justify-center gap-2 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white rounded-lg text-sm font-medium cursor-pointer"
          >
            {busy === 'a4' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Exporter PDF — 8 cartes / page
          </button>

          <button
            onClick={() => run('pvc', () => generateFinalCardsPDF(target, cls, collegeInfo, { ...opts, layout: 'pvc' }), 'PDF format carte généré')}
            disabled={!!busy || !target.length}
            className="flex items-center justify-center gap-2 py-2.5 bg-white border border-slate-200 hover:border-slate-300 disabled:opacity-50 text-slate-700 rounded-lg text-sm font-medium cursor-pointer"
          >
            {busy === 'pvc' ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
            Exporter PDF — 1 carte / page
          </button>

          <button
            onClick={() => run('print', () => printFinalCards(target, cls, collegeInfo, { ...opts, layout: 'pvc' }))}
            disabled={!!busy || !target.length}
            className="flex items-center justify-center gap-2 py-2.5 bg-slate-800 hover:bg-slate-900 disabled:bg-slate-300 text-white rounded-lg text-sm font-medium cursor-pointer"
          >
            {busy === 'print' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
            Imprimer (PVC)
          </button>
        </div>

        <p className="text-xs text-slate-400 mt-3">
          L'impression ouvre la boîte de dialogue du système : choisissez l'imprimante PVC, le format
          ({opts.cardWidthMm} × {opts.cardHeightMm} mm) et le recto/verso.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="bg-white border border-slate-200 rounded-xl p-4 text-center">
          <div className="text-xl font-semibold text-slate-800">{students.length}</div>
          <div className="text-xs text-slate-500 mt-1">Élèves</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 text-center">
          <div className="text-xl font-semibold text-emerald-600">{avecPhoto}</div>
          <div className="text-xs text-slate-500 mt-1">Avec photo</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 text-center">
          <div className="text-xl font-semibold text-rose-500">{students.length - avecPhoto}</div>
          <div className="text-xs text-slate-500 mt-1">Sans photo</div>
        </div>
      </div>

      {/* Verso commun */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 mb-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm font-medium text-slate-800">Verso commun</p>
            <p className="text-xs text-slate-500">Identique sur toutes les cartes de cet établissement.</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <VersoPreview college={collegeInfo} year={year} qrDataUrl={qrDataUrl} />
        </div>
      </div>

      {/* Aperçu des rectos */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <p className="text-sm font-medium text-slate-800 mr-auto">Aperçu des rectos</p>
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Matricule, nom, prénom"
            className="w-56 pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
        {selected.length > 0 && (
          <button
            onClick={() => setSelected([])}
            className="px-3 py-2 bg-white border border-slate-200 hover:border-slate-300 text-slate-700 rounded-lg text-xs font-medium cursor-pointer"
          >
            Annuler la sélection ({selected.length})
          </button>
        )}
      </div>

      {!visibles.length ? (
        <Panel><p className="text-sm text-slate-500">Aucun élève à afficher.</p></Panel>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5">
          {visibles.map(s => {
            const on = selected.includes(s.id);
            return (
              <div key={s.id} className={`bg-white border rounded-xl p-3 transition ${on ? 'border-emerald-400' : 'border-slate-200'}`}>
                <div className="overflow-x-auto">
                  <RectoPreview student={s} cls={cls} college={collegeInfo} year={year} />
                </div>
                <div className="flex items-center gap-2 mt-3">
                  <label className="flex items-center gap-2 text-xs text-slate-600 mr-auto cursor-pointer">
                    <input type="checkbox" checked={on} onChange={() => toggle(s.id)} />
                    Sélectionner
                  </label>
                  <button
                    onClick={() => run(`one-${s.id}`, () => generateSingleCardPDF(s, cls, collegeInfo, opts))}
                    disabled={!!busy}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-slate-200 hover:border-slate-300 disabled:opacity-50 text-slate-700 rounded-md text-xs font-medium cursor-pointer"
                    title="Exporter cette carte en PDF"
                  >
                    <FileDown className="w-3.5 h-3.5" />
                    PDF
                  </button>
                  <button
                    onClick={() => run(`png-${s.id}`, () => generateCardImages([s], cls, collegeInfo, opts))}
                    disabled={!!busy}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-slate-200 hover:border-slate-300 disabled:opacity-50 text-slate-700 rounded-md text-xs font-medium cursor-pointer"
                    title="Exporter cette carte en PNG 300 DPI"
                  >
                    <ImageIcon className="w-3.5 h-3.5" />
                    PNG
                  </button>
                  <button
                    onClick={() => run(`p-${s.id}`, () => printFinalCards([s], cls, collegeInfo, { ...opts, layout: 'pvc' }))}
                    disabled={!!busy}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-900 disabled:opacity-50 text-white rounded-md text-xs font-medium cursor-pointer"
                    title="Imprimer cette carte"
                  >
                    <Printer className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
