import { useState, useEffect, useMemo } from 'react';
import {
  IdCard, LogOut, School, Users, FileText, ChevronRight,
  ArrowLeft, Loader2, Download, Search, Image as ImageIcon, Check, X,
  MessageSquare, Mail, Phone, Send,
} from 'lucide-react';
import { collegeAPI, classAPI, studentAPI, assistanceAPI } from '../services/api';
import ObservationsPanel from '../components/ObservationsPanel';
import {
  generateBrouillonPDF, generateCollegeBrouillonPDF,
} from '../utils/pdfUtils';

// ─── Constantes ──────────────────────────────────────────────────────────────

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
    return (a.serie || '').localeCompare(b.serie || '', 'fr', { numeric: true });
  });

const formatDateFr = (value) => {
  if (!value) return '';
  const m = value.toString().trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : value;
};

const resolveFileUrl = (value, folder) => {
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  const base = (import.meta.env.VITE_API_URL || '').replace(/\/api\/?$/, '');
  return `${base}/uploads/${folder}/${value.split(/[\\\/]/).pop()}`;
};

const photoUrl = (path) => resolveFileUrl(path, 'photos');

// ─── Composants primitifs ────────────────────────────────────────────────────

function Notice({ type = 'error', children, onClose }) {
  const s = type === 'error'
    ? 'bg-rose-50 border-rose-200 text-rose-700'
    : 'bg-emerald-50 border-emerald-200 text-emerald-700';
  return (
    <div className={`mb-4 flex items-start gap-2 px-4 py-3 border rounded-lg text-sm ${s}`}>
      {type === 'error'
        ? <X className="w-4 h-4 mt-0.5 shrink-0" />
        : <Check className="w-4 h-4 mt-0.5 shrink-0" />}
      <span className="flex-1">{children}</span>
      {onClose && (
        <button onClick={onClose} className="cursor-pointer shrink-0">
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

function Empty({ children }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
      <p className="text-sm text-slate-500">{children}</p>
    </div>
  );
}

const COLORS = {
  emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600' },
  cyan:    { bg: 'bg-cyan-50',    text: 'text-cyan-600'    },
  violet:  { bg: 'bg-violet-50',  text: 'text-violet-600'  },
  amber:   { bg: 'bg-amber-50',   text: 'text-amber-600'   },
};

function StatCard({ icon: Icon, label, value, color = 'emerald' }) {
  const c = COLORS[color];
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-4">
      <div className={`w-10 h-10 rounded-lg ${c.bg} flex items-center justify-center shrink-0`}>
        <Icon className={`w-5 h-5 ${c.text}`} />
      </div>
      <div>
        <div className="text-xs text-slate-500 font-medium">{label}</div>
        <div className="text-2xl font-semibold text-slate-800 leading-tight">{value}</div>
      </div>
    </div>
  );
}

// ─── Modal Assistance ─────────────────────────────────────────────────────────

function AssistanceModal({ user, college, onClose }) {
  const [form, setForm] = useState({
    objet: '',
    message: '',
  });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const expediteur = [user.prenom, user.nom].filter(Boolean).join(' ');
  const roleLabel = user.role === 'directeur' ? 'Directeur' : 'Secrétaire';
  const collegeNom = college?.nom || '';

  const handleSend = async () => {
  if (!form.objet.trim() || !form.message.trim()) {
    setError('Veuillez remplir l\'objet et le message.');
    return;
  }
  setError('');
  setSending(true);
  try {
    await assistanceAPI.send({
      objet: form.objet,
      message: form.message,
      collegeNom: college?.nom || '',
      nom: user.nom,
      prenom: user.prenom,
      email: user.email,
      role: user.role,
    });
    setSent(true);
  } catch (err) {
    setError(err.response?.data?.error || 'Erreur lors de l\'envoi.');
  } finally {
    setSending(false);
  }
};
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-emerald-600" />
            <h2 className="text-sm font-semibold text-slate-800">Contacter l'assistance</h2>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {sent ? (
            <div className="py-6 text-center">
              <Check className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
              <p className="text-sm font-medium text-slate-800">Message préparé</p>
              <p className="text-xs text-slate-500 mt-1">
                Votre client mail s'est ouvert avec le message prérempli. Cliquez sur Envoyer dans votre messagerie.
              </p>
              <button
                onClick={onClose}
                className="mt-4 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium cursor-pointer"
              >
                Fermer
              </button>
            </div>
          ) : (
            <>
              {/* Champs préremplis (lecture seule) */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">De</label>
                  <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700">
                    {expediteur} · {roleLabel}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Collège</label>
                  <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 truncate">
                    {collegeNom || '—'}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Destinataire</label>
                <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700">
                  vladimirfaton@gmail.com
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Objet <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.objet}
                  onChange={e => setForm({ ...form, objet: e.target.value })}
                  placeholder="Ex : Problème de connexion, Question sur les cartes..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Message <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={4}
                  value={form.message}
                  onChange={e => setForm({ ...form, message: e.target.value })}
                  placeholder="Décrivez votre problème ou votre question..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                />
              </div>

              {error && <p className="text-xs text-rose-600">{error}</p>}

              <button
                onClick={handleSend}
                disabled={sending}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white rounded-lg text-sm font-medium cursor-pointer"
              >
                <Send className="w-4 h-4" />
                {sending ? 'Préparation...' : 'Envoyer le message'}
              </button>

              {/* Contact téléphonique */}
              <div className="flex items-center gap-3 pt-2 border-t border-slate-100">
                <Phone className="w-4 h-4 text-slate-400 shrink-0" />
                <div className="text-xs text-slate-500">
                  Vous préférez appeler ?{' '}
                  <a href="tel:+2290147611499" className="font-medium text-emerald-700 hover:underline">
                    +229 01 47 61 14 99
                  </a>
                  {' '}ou{' '}
                  <a href="tel:+2290157129474" className="font-medium text-emerald-700 hover:underline">
                    +229 01 57 12 94 74
                  </a>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Modal Observation par élève ─────────────────────────────────────────────

function ObservationEleveModal({ student, classId, onClose, onSaved }) {
  const prefix = `[${student.matricule} — ${student.nom} ${student.prenom}] `;
  const [contenu, setContenu] = useState(prefix);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
  if (!contenu.trim() || contenu.trim() === prefix.trim()) {
    setError('Ajoutez un commentaire après l\'identifiant de l\'élève.');
    return;
  }
  setError('');
  setSubmitting(true);
  try {
    await classAPI.createObservation(classId, contenu.trim(), student.id); // on passe eleve_id
    onSaved();
    onClose();
  } catch (err) {
    setError(err.response?.data?.error || 'Erreur lors de l\'envoi.');
  } finally {
    setSubmitting(false);
  }
};
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-emerald-600" />
            <h2 className="text-sm font-semibold text-slate-800">Observation</h2>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg">
            <p className="text-xs text-slate-500 mb-0.5">Élève concerné</p>
            <p className="text-sm font-medium text-slate-800">
              {student.nom} {student.prenom}
              <span className="ml-2 text-xs text-slate-400 font-normal">{student.matricule}</span>
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Observation <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={4}
              value={contenu}
              onChange={e => setContenu(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none font-mono"
              autoFocus
              onFocus={e => {
                // Positionner le curseur à la fin
                const len = e.target.value.length;
                e.target.setSelectionRange(len, len);
              }}
            />
            <p className="text-xs text-slate-400 mt-1">
              L'identifiant de l'élève est prérempli au début du texte.
            </p>
          </div>

          {error && <p className="text-xs text-rose-600">{error}</p>}

          <div className="flex gap-2">
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white rounded-lg text-sm font-medium cursor-pointer"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {submitting ? 'Envoi...' : 'Enregistrer'}
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium cursor-pointer"
            >
              Annuler
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function DashboardGestion({ onLogout }) {
  const user = useMemo(() => {
    try { return JSON.parse(sessionStorage.getItem('user') || '{}'); } catch { return {}; }
  }, []);

  const isSecretaire = user.role === 'secretaire';
  const collegeId = user.college_id;

  const [college, setCollege]   = useState(null);
  const [classes, setClasses]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [showAssistance, setShowAssistance] = useState(false);

  const [activeClass, setActiveClass] = useState(null);
  const [students, setStudents]       = useState([]);
  const [studentsLoading, setStudentsLoading] = useState(false);

  useEffect(() => {
    if (!collegeId) { setLoading(false); return; }
    (async () => {
      try {
        const [colResult, clsRes] = await Promise.allSettled([
          collegeAPI.getById(collegeId),
          classAPI.getByCollege(collegeId),
        ]);
        if (colResult.status === 'fulfilled') {
          setCollege(colResult.value.data);
        } else {
          setCollege({ id: collegeId, nom: user.college_nom || '' });
        }
        if (clsRes.status === 'fulfilled') {
          setClasses(trierClasses(clsRes.value.data || []));
        } else {
          setError('Impossible de charger les classes.');
        }
      } catch {
        setError('Impossible de charger les données. Vérifiez votre connexion.');
      } finally {
        setLoading(false);
      }
    })();
  }, [collegeId]);

  const openClass = async (cls) => {
    setActiveClass(cls);
    setStudents([]);
    setStudentsLoading(true);
    try {
      const r = await studentAPI.getByClass(cls.id);
      setStudents(r.data?.students || r.data || []);
    } catch {
      setStudents([]);
    } finally {
      setStudentsLoading(false);
    }
  };

  const goBack = () => {
    setActiveClass(null);
    setStudents([]);
  };

  const stats = useMemo(() => ({
    classes: classes.length,
    eleves: classes.reduce((s, c) => s + (c.effectif ?? 0), 0),
  }), [classes]);

  return (
    <div className="min-h-screen bg-[#f7faf8]">
      {showAssistance && (
        <AssistanceModal
          user={user}
          college={college}
          onClose={() => setShowAssistance(false)}
        />
      )}

      <header className="sticky top-0 z-30 bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-600 flex items-center justify-center shrink-0">
              <IdCard className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-semibold text-slate-800 leading-tight truncate">
                {college?.nom || 'Espace gestion'}
              </h1>
              <p className="text-xs text-slate-500">
                {user.prenom} {user.nom}
                <span className="ml-1.5 text-slate-300">·</span>
                <span className="ml-1.5 capitalize">{user.role}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAssistance(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition cursor-pointer"
            >
              <Mail className="w-4 h-4" />
              Assistance
            </button>
            <button
              onClick={onLogout}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              Déconnexion
            </button>
          </div>
        </div>
      </header>

      {!activeClass && (
        <div className="bg-[#f7faf8] border-b border-slate-200">
          <div className="max-w-6xl mx-auto px-6 py-5">
            <div className="grid grid-cols-2 gap-3">
              <StatCard icon={School} label="Classes" value={stats.classes} color="emerald" />
              <StatCard icon={Users}  label="Élèves"  value={stats.eleves}  color="cyan"    />
            </div>
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex items-center gap-2 mb-5 text-sm">
          {activeClass ? (
            <>
              <button
                onClick={goBack}
                className="flex items-center gap-1.5 text-slate-500 hover:text-slate-800 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                Classes
              </button>
              <span className="text-slate-300">|</span>
              <span className="text-emerald-700 font-medium">{activeClass.code}</span>
            </>
          ) : (
            <span className="text-slate-700 font-medium">Classes</span>
          )}
        </div>

        {error && <Notice onClose={() => setError('')}>{error}</Notice>}

        {loading ? (
          <div className="flex items-center justify-center py-20 text-slate-400">
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
            <span className="text-sm">Chargement</span>
          </div>
        ) : (
          <>
            {!activeClass && (
              <ClassesView classes={classes} college={college} onOpen={openClass} />
            )}
            {activeClass && (
              <ClasseDetail
                cls={activeClass}
                students={students}
                loading={studentsLoading}
                college={college}
                isSecretaire={isSecretaire}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── Vue liste des classes ────────────────────────────────────────────────────

function ClassesView({ classes, college, onOpen }) {
  const [search, setSearch]       = useState('');
  const [generating, setGenerating] = useState(false);
  const [error, setError]         = useState('');
  const [notice, setNotice]       = useState('');

  const flash = (msg) => { setNotice(msg); setTimeout(() => setNotice(''), 4000); };

  const q = search.trim().toLowerCase();
  const visibles = q ? classes.filter(c => (c.code || '').toLowerCase().includes(q)) : classes;

  const handleBrouillonCollege = async () => {
    setError('');
    setGenerating(true);
    try {
      const withStudents = [];
      for (const cls of classes) {
        const r = await studentAPI.getByClass(cls.id);
        withStudents.push({ classInfo: cls, students: r.data?.students || r.data || [] });
      }
      await generateCollegeBrouillonPDF(withStudents, college);
      flash('Brouillon téléchargé');
    } catch {
      setError('Erreur lors de la génération du brouillon');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div>
      {error  && <Notice onClose={() => setError('')}>{error}</Notice>}
      {notice && <Notice type="success" onClose={() => setNotice('')}>{notice}</Notice>}

      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="relative mr-auto">
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
          onClick={handleBrouillonCollege}
          disabled={generating || !classes.length}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 hover:border-slate-300 disabled:opacity-50 disabled:cursor-not-allowed text-slate-700 rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap"
        >
          {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          {generating ? 'Génération...' : 'Brouillon du collège'}
        </button>
      </div>

      {!visibles.length ? (
        <Empty>
          {q ? `Aucune classe ne correspond à « ${search} ».` : 'Aucune classe enregistrée.'}
        </Empty>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {visibles.map(cls => (
            <button
              key={cls.id}
              onClick={() => onOpen(cls)}
              className="bg-white border border-slate-200 hover:border-emerald-300 rounded-xl p-5 text-left cursor-pointer transition group"
            >
              <div className="flex items-start justify-between mb-3">
                <span className="text-base font-semibold text-slate-800 group-hover:text-emerald-700 transition">
                  {cls.code}
                </span>
                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 transition mt-0.5" />
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <Users className="w-3.5 h-3.5" />
                {cls.effectif ?? 0} élève{(cls.effectif ?? 0) > 1 ? 's' : ''}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Détail d'une classe ──────────────────────────────────────────────────────

const CLASS_TABS = [
  { key: 'eleves',       label: 'Élèves',       icon: Users          },
  { key: 'brouillon',   label: 'Brouillon',    icon: FileText       },
  { key: 'observations', label: 'Observations', icon: MessageSquare  },
];

function ClasseDetail({ cls, students, loading, college, isSecretaire }) {
  const [tab, setTab] = useState('eleves');

  return (
    <div>
      <div className="flex gap-1 mb-6 border-b border-slate-200">
        {CLASS_TABS.map(t => {
          const Icon = t.icon;
          const on = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 px-3 py-2.5 text-sm font-medium border-b-2 transition cursor-pointer ${
                on ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Icon className="w-4 h-4" />
              {t.label}
              {t.key === 'eleves' && !loading && (
                <span className="text-xs text-slate-400">({students.length})</span>
              )}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-slate-400">
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
          <span className="text-sm">Chargement des élèves</span>
        </div>
      ) : (
        <>
          {tab === 'eleves'       && <ElevesTab students={students} classId={cls.id} isSecretaire={isSecretaire} />}
          {tab === 'brouillon'    && <BrouillonTab cls={cls} students={students} college={college} />}
          {tab === 'observations' && <ObservationsTab cls={cls} />}
        </>
      )}
    </div>
  );
}

// ─── Tab Élèves ───────────────────────────────────────────────────────────────

function ElevesTab({ students, classId, isSecretaire }) {
  const [search, setSearch]   = useState('');
  const [obsTarget, setObsTarget] = useState(null); // élève ciblé par la modal obs
  const [obsNotice, setObsNotice] = useState('');

  const flashObs = (msg) => { setObsNotice(msg); setTimeout(() => setObsNotice(''), 3000); };

  const visibles = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return students;
    return students.filter(s =>
      [s.matricule, s.nom, s.prenom].some(v => (v || '').toLowerCase().includes(q))
    );
  }, [students, search]);

  if (!students.length) return <Empty>Aucun élève dans cette classe.</Empty>;

  return (
    <div>
      {obsTarget && (
        <ObservationEleveModal
          student={obsTarget}
          classId={classId}
          onClose={() => setObsTarget(null)}
          onSaved={() => flashObs(`Observation enregistrée pour ${obsTarget.nom} ${obsTarget.prenom}`)}
        />
      )}

      <div className="flex items-center gap-3 mb-4">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Matricule, nom, prénom"
            className="w-64 pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
        <span className="text-xs text-slate-400 ml-auto">
          {visibles.length} / {students.length} élève{students.length > 1 ? 's' : ''}
        </span>
      </div>

      {obsNotice && (
        <div className="mb-3 px-4 py-2 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg text-xs flex items-center gap-2">
          <Check className="w-3.5 h-3.5 shrink-0" />
          {obsNotice}
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr className="text-left text-xs font-medium text-slate-500">
              <th className="px-4 py-3">Photo</th>
              <th className="px-4 py-3">Matricule</th>
              <th className="px-4 py-3">Nom & Prénom</th>
              <th className="px-4 py-3">Sexe</th>
              <th className="px-4 py-3">Date de naissance</th>
              <th className="px-4 py-3">Lieu</th>
              <th className="px-4 py-3">Nationalité</th>
              <th className="px-4 py-3">Téléphone parent/tuteur</th>
              {isSecretaire && <th className="px-4 py-3 text-right">Action</th>}
            </tr>
          </thead>
          <tbody>
            {visibles.map(s => (
              <tr key={s.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60">
                <td className="px-4 py-3">
                  <div className="w-9 h-9 rounded-md bg-slate-100 overflow-hidden flex items-center justify-center shrink-0">
                    {s.photo_path
                      ? <img src={photoUrl(s.photo_path)} alt={s.nom} className="w-full h-full object-cover" />
                      : <ImageIcon className="w-4 h-4 text-slate-300" />
                    }
                  </div>
                </td>
                <td className="px-4 py-3 font-medium text-slate-800">{s.matricule}</td>
                <td className="px-4 py-3 text-slate-700">{s.nom} {s.prenom}</td>
                <td className="px-4 py-3 text-slate-600">{s.sexe}</td>
                <td className="px-4 py-3 text-slate-600">{formatDateFr(s.date_naissance) || '—'}</td>
                <td className="px-4 py-3 text-slate-600">{s.lieu_naissance || '—'}</td>
                <td className="px-4 py-3 text-slate-600">{s.nationalite || '—'}</td>
                <td className="px-4 py-3 text-slate-600">{s.telephone || '—'}</td>
                {isSecretaire && (
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => setObsTarget(s)}
                      title="Ajouter une observation"
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg cursor-pointer transition"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      Observation
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Tab Brouillon ────────────────────────────────────────────────────────────

function BrouillonTab({ cls, students, college }) {
  const [generating, setGenerating] = useState(false);
  const [error, setError]           = useState('');
  const [notice, setNotice]         = useState('');

  const flash = (msg) => { setNotice(msg); setTimeout(() => setNotice(''), 4000); };

  const avecPhoto = students.filter(s => s.photo_path).length;
  const sansPhoto = students.length - avecPhoto;

  const exportPDF = async () => {
    setError('');
    setGenerating(true);
    try {
      await generateBrouillonPDF(students, cls, college);
      flash('PDF téléchargé');
    } catch {
      setError('Erreur lors de la génération du PDF');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div>
      {error  && <Notice onClose={() => setError('')}>{error}</Notice>}
      {notice && <Notice type="success" onClose={() => setNotice('')}>{notice}</Notice>}

      <div className="grid grid-cols-3 gap-3 mb-5">
        <StatCard icon={Users}     label="Élèves"     value={students.length} color="emerald" />
        <StatCard icon={Check}     label="Avec photo" value={avecPhoto}       color="cyan"    />
        <StatCard icon={ImageIcon} label="Sans photo" value={sansPhoto}       color={sansPhoto > 0 ? 'amber' : 'emerald'} />
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-5 mb-6">
        <p className="text-sm font-medium text-slate-800 mb-1">Exporter le brouillon</p>
        <p className="text-xs text-slate-500 mb-4">
          Liste complète A4 paysage — photo, matricule, nom, prénom, classe, date et lieu de naissance, nationalité, téléphone parent/tuteur.
        </p>
        <button
          onClick={exportPDF}
          disabled={generating || !students.length}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white rounded-lg text-sm font-medium cursor-pointer"
        >
          {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          {generating ? 'Génération...' : 'Télécharger le PDF'}
        </button>
      </div>

      {!students.length ? (
        <Empty>Aucun élève dans cette classe.</Empty>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
          {students.map(s => (
            <div key={s.id} className="flex items-center gap-4 px-5 py-3">
              <div className="w-10 h-10 rounded-lg bg-slate-100 overflow-hidden flex items-center justify-center shrink-0">
                {s.photo_path
                  ? <img src={photoUrl(s.photo_path)} alt={s.nom} className="w-full h-full object-cover" />
                  : <ImageIcon className="w-4 h-4 text-slate-300" />
                }
              </div>
              <div className="flex-1 min-w-0 grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-0.5 text-sm">
                <span className="font-medium text-slate-800 truncate">{s.nom} {s.prenom}</span>
                <span className="text-slate-500 text-xs">{s.matricule}</span>
                <span className="text-slate-500 text-xs">{formatDateFr(s.date_naissance) || '—'}</span>
                <span className="text-slate-500 text-xs">{s.nationalite || '—'}</span>
              </div>
              <span className={`text-xs font-medium px-2 py-0.5 rounded shrink-0 ${
                s.photo_path ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
              }`}>
                {s.photo_path ? 'Photo OK' : 'Sans photo'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Tab Observations ─────────────────────────────────────────────────────────

function ObservationsTab({ cls }) {
  return (
    <div className="max-w-2xl">
      <ObservationsPanel classId={cls.id} />
    </div>
  );
}