import { useEffect, useState } from 'react';
import { Banknote, Building2, CalendarDays, ChevronLeft, ChevronRight, IdCard, KeyRound, LayoutDashboard, LogOut, MapPin, Pencil, Plus, Save, School, Search, UserPlus, UserRound, Users } from 'lucide-react';
import { authAPI, censeurAPI, comptabiliteAPI, directionAPI, platformAPI, secretariatAPI } from '../services/api';
import { PLATFORM_NAME } from '../config/branding';
import { generatePaymentReceiptPDF } from '../utils/paymentReceipt';
import { matchClassSearch, matchStudentSearch } from '../utils/searchUtils';
import DirectorCockpit from './DirectorCockpit';
import DirectorWorkspace from './DirectorWorkspace';
import ManagementWorkspace from './ManagementWorkspace';
import CenseurPedagogy from './CenseurPedagogy';
import StudentImportPanel from './StudentImportPanel';
import AssistancePanel from './AssistancePanel';

const labels = { directeur: 'Directeur', secretaire: 'Secrétaire', comptable: 'Comptable', censeur: 'Censeur' };
const money = (value) => `${Number(value || 0).toLocaleString('fr-FR')} F CFA`;
const blankStudent = { matricule: '', nom: '', prenom: '', sexe: '', date_naissance: '', lieu_naissance: '', nationalite: '', telephone: '' };
const classRank = (value = '') => { const level = value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); const found = level.match(/(?:^|\s)(6|5|4|3)(?:e|eme)?|(?:^|\s)(2nde|2nd|seconde|1ere|1re|tle|terminale)/); const key = found?.[1] || found?.[2] || ''; return ({ 6: 1, 5: 2, 4: 3, 3: 4, '2nde': 5, '2nd': 5, seconde: 5, '1ere': 6, '1re': 6, tle: 7, terminale: 7 })[key] || 99; };
const sortClasses = (classes = []) => [...classes].sort((a, b) => { const rank = classRank(a.code_affichage) - classRank(b.code_affichage); return rank || a.code_affichage.localeCompare(b.code_affichage, 'fr', { numeric: true, sensitivity: 'base' }); });
const classLevelCode = (value = '') => { const normalized = value.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s/g, ''); if (['6', '6e', '6eme'].includes(normalized)) return '6e'; if (['5', '5e', '5eme'].includes(normalized)) return '5e'; if (['4', '4e', '4eme'].includes(normalized)) return '4e'; if (['3', '3e', '3eme'].includes(normalized)) return '3e'; if (['2nde', '2nd', 'seconde'].includes(normalized)) return '2nde'; if (['1ere', '1re'].includes(normalized)) return '1ere'; if (['tle', 'terminale', 'term'].includes(normalized)) return 'terminale'; return ''; };

export default function ManagementDashboard({ onLogout }) {
  const [user, setUser] = useState(null); const [section, setSection] = useState('tableau'); const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState(''); const [error, setError] = useState(''); const [profileEdit, setProfileEdit] = useState(false);
  const [profile, setProfile] = useState({ nom: '', prenom: '', email: '', telephone: '' }); const [password, setPassword] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [direction, setDirection] = useState(null); const [establishmentName, setEstablishmentName] = useState(''); const [secretaryClasses, setSecretaryClasses] = useState([]); const [censeurClasses, setCenseurClasses] = useState([]); const [classDetail, setClassDetail] = useState(null);
  const [cash, setCash] = useState(null); const [enrollOptions, setEnrollOptions] = useState(null); const [paymentOptions, setPaymentOptions] = useState([]); const [monitoring, setMonitoring] = useState(null); const [finance, setFinance] = useState(null); const [censeurProfessors, setCenseurProfessors] = useState([]); const [censeurSubjects, setCenseurSubjects] = useState([]);
  const [yearForm, setYearForm] = useState({ libelle: '', dateDebut: '', dateFin: '' }); const [siteForm, setSiteForm] = useState({ nom: '', adresse: '', commune: '', departement: '', telephone: '', email: '' }); const [classForm, setClassForm] = useState({ nom: '', divisionNom: '', divisionType: '' });
  const [editingStudent, setEditingStudent] = useState(null); const [transferStudent, setTransferStudent] = useState(null);
  const [enrollForm, setEnrollForm] = useState({ type: 'inscription', studentId: '', annualClassId: '', ...blankStudent });
  const refresh = async (role) => { if (role === 'directeur') setDirection((await directionAPI.overview()).data); if (role === 'secretaire') setSecretaryClasses((await secretariatAPI.listClasses()).data?.classes || []); if (role === 'comptable') { const [cashData, enrollmentData, paymentData, financialConfiguration] = await Promise.all([comptabiliteAPI.cashOverview(), comptabiliteAPI.enrollmentOptions(), comptabiliteAPI.paymentOptions(), comptabiliteAPI.financialConfiguration()]); const enrollment = enrollmentData.data || {}; const financial = financialConfiguration.data || {}; setCash(cashData.data || null); setEnrollOptions({ ...enrollment, classes: Array.isArray(enrollment.classes) ? enrollment.classes : [], students: Array.isArray(enrollment.students) ? enrollment.students : [] }); setPaymentOptions(Array.isArray(paymentData.data?.students) ? paymentData.data.students : []); setFinance({ ...financial, fees: Array.isArray(financial.fees) ? financial.fees : [], classes: Array.isArray(financial.classes) ? financial.classes : [] }); } if (role === 'censeur') { const [monitoringData, classesData, professorsData, subjectsData] = await Promise.all([censeurAPI.overview(), censeurAPI.listClasses(), censeurAPI.listProfessors(), censeurAPI.listSubjects()]); setMonitoring(monitoringData.data); setCenseurClasses(classesData.data?.classes || []); setCenseurProfessors(professorsData.data?.professeurs || []); setCenseurSubjects(subjectsData.data?.matieres || []); } };
  const loadClass = async (classId) => { try { const api = user.role === 'directeur' ? directionAPI : user.role === 'censeur' ? censeurAPI : secretariatAPI; setClassDetail((await api.listStudentsByClass(classId)).data); } catch { setError('Impossible de charger cette classe.'); } };
  useEffect(() => { authAPI.getMyProfile().then(async ({ data }) => { setUser(data.user); setProfile({ nom: data.user.nom || '', prenom: data.user.prenom || '', email: data.user.email || '', telephone: data.user.telephone || '' }); const [establishment] = await Promise.all([platformAPI.getEstablishment(), refresh(data.user.role)]); setEstablishmentName(establishment.data.etablissement?.nom || ''); }).catch(() => setError('Impossible de charger votre compte.')).finally(() => setLoading(false)); }, []);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(''), 5000);
    return () => clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => setError(''), 8000);
    return () => clearTimeout(timer);
  }, [error]);

useEffect(() => {
  if (!user) return;
  if (section === 'finances') return;
  const interval = setInterval(() => { refresh(user.role); }, 30000);
  return () => clearInterval(interval);
}, [user, section]);
  const action = async (work, success, after) => { setError(''); setNotice(''); try { await work(); await refresh(user.role); if (after) await after(); setNotice(success); } catch (err) { setError(err.response?.data?.error || 'Opération impossible.'); } };
const saveProfile = (event, newUsername) => { event.preventDefault(); action(async () => { const payload = { ...profile, ...(newUsername ? { username: newUsername } : {}) }; const { data } = await authAPI.updateMyProfile(payload); setUser(data.user); sessionStorage.setItem('user', JSON.stringify(data.user)); setProfileEdit(false); }, 'Informations personnelles enregistrées.'); };
  const savePassword = (event) => { event.preventDefault(); action(async () => { await authAPI.changeMyPassword(password); setPassword({ currentPassword: '', newPassword: '', confirmPassword: '' }); setUser({ ...user, passwordPersonalized: true }); }, 'Mot de passe modifié.'); };
  const createYear = (event) => { event.preventDefault(); action(() => directionAPI.createFirstSchoolYear(yearForm), 'Année scolaire activée.'); };
  const createSite = (event) => { event.preventDefault(); action(() => directionAPI.createSite(siteForm), 'Nouveau site créé.', async () => setSiteForm({ nom: '', adresse: '', commune: '', departement: '', telephone: '', email: '' })); };
  const saveFinancialConfiguration = (payload) => action(() => comptabiliteAPI.saveFinancialConfiguration(payload), 'Configuration financière enregistrée.');
  const createClass = (event) => { event.preventDefault(); const niveauCode = classLevelCode(classForm.nom); const divisionType = classForm.divisionType || (['6e', '5e', '4e'].includes(niveauCode) ? 'groupe' : ['2nde', '1ere', 'terminale'].includes(niveauCode) ? 'serie' : ''); if (!niveauCode) return setError('Choisissez un niveau valide : 6ème, 5ème, 4ème, 3ème, 2nde, 1ère ou Terminale.'); if (!classForm.divisionNom?.trim() || !divisionType) return setError('Indiquez le groupe ou la série de la classe.'); action(() => secretariatAPI.createClass({ niveauCode, divisionNom: classForm.divisionNom.trim(), divisionType }), 'Classe annuelle créée.', async () => setClassForm({ nom: '', divisionNom: '', divisionType: '' })); };
  const updateStudent = (event) => { event.preventDefault(); action(() => secretariatAPI.updateStudent(editingStudent.id, editingStudent), 'Informations de l’élève mises à jour.', async () => { const id = classDetail.classInfo.id; setEditingStudent(null); await loadClass(id); }); };
  const moveStudent = (event) => { event.preventDefault(); action(() => secretariatAPI.transferStudent(transferStudent.id, transferStudent.destinationClassId), 'Transfert interne enregistré.', async () => { const id = classDetail.classInfo.id; setTransferStudent(null); await loadClass(id); }); };
  const createEnrollment = (event) => { event.preventDefault(); const payload = enrollForm.type === 'reinscription' ? { type: 'reinscription', studentId: enrollForm.studentId, annualClassId: enrollForm.annualClassId } : { ...enrollForm }; action(() => comptabiliteAPI.createEnrollment(payload), 'Inscription enregistrée. Les effectifs sont actualisés immédiatement.', async () => setEnrollForm({ type: 'inscription', studentId: '', annualClassId: '', ...blankStudent })); };
  const createPayment = async (payload) => { setError(''); setNotice(''); try { const { data } = await comptabiliteAPI.createPayment(payload); await generatePaymentReceiptPDF(data); await refresh(user.role); setNotice('Paiement enregistré. Le reçu interne a été téléchargé.'); } catch (err) { setError(err.response?.data?.error || 'Paiement impossible.'); } };
  if (loading) return <main className="min-h-screen grid place-items-center bg-slate-50 text-slate-500">Chargement...</main>;
  const content = section === 'profil' ? <Profile profile={profile} setProfile={setProfile} edit={profileEdit} setEdit={setProfileEdit} save={saveProfile} username={user.username}/> : section === 'securite' ? <Security password={password} setPassword={setPassword} save={savePassword}/> : <RoleContent {...{ role: user.role, section, setSection, direction, establishmentName, finance, saveFinancialConfiguration, secretaryClasses, censeurClasses, classDetail, loadClass, setClassDetail, classForm, setClassForm, createClass, yearForm, setYearForm, createYear, editingStudent, setEditingStudent, updateStudent, transferStudent, setTransferStudent, moveStudent, cash, enrollOptions, enrollForm, setEnrollForm, createEnrollment, paymentOptions, createPayment, monitoring }}/>;
  if (user.role === 'directeur') return <DirectorWorkspace user={user} establishmentName={establishmentName} onLogout={onLogout} section={section} setSection={setSection} content={content} error={error} notice={notice} cockpitProps={{ direction, yearForm, setYearForm, createYear }} />;
  return <ManagementWorkspace role={user.role} user={user} establishmentName={establishmentName} section={section} setSection={setSection} onLogout={onLogout} content={content} error={error} notice={notice} />;
  return <div className="min-h-screen bg-[#f7faf8] flex"><aside className="hidden md:flex w-64 shrink-0 bg-white border-r border-slate-200 p-5 flex-col sticky top-0 h-screen"><div className="flex items-center gap-3"><div className="w-9 h-9 rounded-lg bg-emerald-600 flex items-center justify-center"><IdCard className="w-5 h-5 text-white"/></div><div><h1 className="text-lg font-semibold text-slate-800 leading-tight">{PLATFORM_NAME}</h1><p className="text-xs text-slate-500">Espace {labels[user.role]}</p></div></div><nav className="mt-9 space-y-1">{menu(user.role).map((item) => <button key={item.id} onClick={() => { setSection(item.id); setClassDetail(null); }} className={`w-full text-left flex items-center gap-3 px-3 py-3 rounded-lg text-sm transition ${section === item.id ? 'bg-emerald-50 text-emerald-700 font-medium' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}>{item.icon}{item.label}</button>)}</nav><button onClick={onLogout} className="mt-auto flex items-center gap-3 px-3 py-3 text-sm text-slate-600 hover:bg-slate-100 hover:text-slate-900 rounded-lg transition"><LogOut className="w-4"/>Déconnexion</button></aside><div className="flex-1 min-w-0"><header className="sticky top-0 z-30 bg-white border-b border-slate-200"><div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3"><div className="flex min-w-0 items-center gap-3"><div className="w-8 h-8 shrink-0 rounded-lg bg-emerald-600 flex items-center justify-center"><IdCard className="w-4 h-4 text-white"/></div><div className="min-w-0"><h1 className="truncate text-sm font-semibold text-slate-800">{PLATFORM_NAME} · {labels[user.role]}</h1><p className="truncate text-xs text-slate-500">{user.prenom} {user.nom}</p></div></div><div className="flex shrink-0 items-center gap-2"><span className="hidden text-xs text-slate-500 sm:inline">{section === 'tableau' ? 'Tableau de bord' : menu(user.role).find((item) => item.id === section)?.label}</span><button onClick={onLogout} title="Déconnexion" aria-label="Déconnexion" className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900"><LogOut className="w-4"/></button></div></div></header><main className="max-w-7xl mx-auto px-3 py-5 sm:px-6 sm:py-7">{!user.passwordPersonalized && <Notice>Mot de passe initial encore actif : personnalisez-le dans « Sécurité ».</Notice>}{error && <Notice type="error">{error}</Notice>}{notice && <Notice type="success">{notice}</Notice>}<section>{content}</section></main></div></div>;
}

function menu(role) { const dashboard = { id: 'tableau', label: 'Tableau de bord', icon: <LayoutDashboard className="w-4"/> }; const profile = { id: 'profil', label: 'Informations personnelles', icon: <UserRound className="w-4"/> }; const security = { id: 'securite', label: 'Sécurité', icon: <KeyRound className="w-4"/> }; const items = { directeur: [], secretaire: [{ id: 'classes', label: 'Classes et élèves', icon: <School className="w-4"/> }], comptable: [{ id: 'inscriptions', label: 'Inscriptions', icon: <UserPlus className="w-4"/> }, { id: 'finances', label: 'Frais et tarifs', icon: <Banknote className="w-4"/> }, { id: 'caisse', label: 'Caisse', icon: <Banknote className="w-4"/> }], censeur: [{ id: 'classes', label: 'Classes et élèves', icon: <Users className="w-4"/> }] }; return [dashboard, ...(items[role] || []), profile, security]; }
function RoleIdentity({ role }) { const identity = { directeur: { title: 'Direction', subtitle: 'Pilotez l’établissement, les années scolaires et les effectifs.', classes: 'bg-emerald-50 border-emerald-200 text-emerald-700' }, secretaire: { title: 'Secrétariat', subtitle: 'Organisez les classes, les élèves et les dossiers scolaires.', classes: 'bg-sky-50 border-sky-200 text-sky-700' }, comptable: { title: 'Comptabilité', subtitle: 'Suivez les inscriptions, les frais et les encaissements.', classes: 'bg-amber-50 border-amber-200 text-amber-700' }, censeur: { title: 'Censeur', subtitle: 'Consultez les classes et surveillez les mouvements d’élèves.', classes: 'bg-violet-50 border-violet-200 text-violet-700' } }[role] || { title: 'Espace de gestion', subtitle: 'Accès aux opérations autorisées pour votre compte.', classes: 'bg-slate-50 border-slate-200 text-slate-700' }; return <div className={`mb-6 rounded-2xl border p-5 ${identity.classes}`}><p className="text-xs font-semibold uppercase tracking-[0.16em]">Espace {identity.title}</p><p className="mt-2 text-sm text-slate-600">{identity.subtitle}</p></div>; }
function RoleContent(props) { if (props.role === 'directeur') return props.section === 'assistance' ? <AssistancePanel user={props.user} establishmentName={props.establishmentName}/> : <DirectorCockpit {...props}/>; const view = props.role === 'secretaire' ? (props.section === 'classes' ? <ClassRegistry {...props} editable/> : props.section === 'assistance' ? <AssistancePanel user={props.user} establishmentName={props.establishmentName}/> : <SecretaryHome {...props}/>) : props.role === 'comptable' ? (props.section === 'inscriptions' ? <><Enroll {...props}/><StudentImportPanel/></> : props.section === 'finances' ? <FinanceSettings {...props}/> : props.section === 'assistance' ? <AssistancePanel user={props.user} establishmentName={props.establishmentName}/> : <Accountant {...props}/>) : props.role === 'censeur' ? (props.section === 'classes' ? <ClassRegistry {...props}/> : props.section === 'pedagogie' ? <CenseurPedagogy/> : props.section === 'assistance' ? <AssistancePanel user={props.user} establishmentName={props.establishmentName}/> : <Monitoring {...props}/>) : null; return <><RoleIdentity role={props.role}/>{view}</>; }
function DirectorHome({ direction, yearForm, setYearForm, createYear, classDetail, setClassDetail, loadClass }) { const set = (key) => (e) => setYearForm({ ...yearForm, [key]: e.target.value }); const totalClasses = direction?.classes?.length || 0; const totalStudents = direction?.sites?.reduce((sum, site) => sum + Number(site.students_count || 0), 0) || 0; if (classDetail?.classInfo) return <ClassStudents editable={false} classes={direction?.classes || []} classDetail={classDetail} setClassDetail={setClassDetail}/>; return <><Title title="Tableau de bord" subtitle="Pilotage général de l�?Tétablissement"/><div className="grid grid-cols-2 lg:grid-cols-4 gap-4"><Card icon={<Building2/>} label="�?tablissement" value={direction?.etablissement?.nom || '�?"'}/><Card icon={<CalendarDays/>} label="Année active" value={direction?.anneeActive?.libelle || '�? configurer'}/><Card icon={<School/>} label="Classes actives" value={totalClasses}/><Card icon={<Users/>} label="�?lèves inscrits" value={totalStudents}/></div>{!direction?.anneeActive && <Panel title="Lancer la première année scolaire"><form onSubmit={createYear} className="grid sm:grid-cols-3 gap-3"><Input label="Année scolaire" placeholder="2026-2027" value={yearForm.libelle} onChange={set('libelle')} required/><Input label="Début" type="date" value={yearForm.dateDebut} onChange={set('dateDebut')} required/><Input label="Fin" type="date" value={yearForm.dateFin} onChange={set('dateFin')} required/><button className="sm:col-span-3 primary">Activer l�?Tannée scolaire</button></form></Panel>}<Panel title="Classes de l�?Tétablissement"><div className="grid sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-3">{direction?.classes?.length ? sortClasses(direction.classes).map((item) => <button key={item.id} onClick={() => loadClass(item.id)} className="text-left border border-slate-200 rounded-xl p-3 hover:border-emerald-500 hover:bg-emerald-50/30 transition"><p className="font-semibold text-slate-800 text-sm">{item.code_affichage}</p><p className="text-xs text-slate-500 mt-2">{item.effectif} élève(s)</p><p className="text-xs text-slate-400 mt-1 truncate">{item.site_nom}</p></button>) : <Empty>Aucune classe pour l�?Tannée active.</Empty>}</div></Panel></>; }
function Sites({ direction, siteForm, setSiteForm, createSite }) { const set = (key) => (event) => setSiteForm({ ...siteForm, [key]: event.target.value }); return <><Title title="Sites et filiales" subtitle="Le site principal est créé à l�?Tinstallation. Ajoutez une filiale seulement si elle partage le même établissement."/><div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">{direction?.sites?.map((site) => <Card key={site.id} icon={<MapPin/>} label={site.est_principal ? 'Site principal' : 'Filiale'} value={site.nom}><p className="text-xs text-slate-500 mt-3">{site.classes_count} classe(s) · {site.students_count} élève(s)</p></Card>)}</div><Panel title="Ajouter un site"><form onSubmit={createSite} className="grid sm:grid-cols-2 gap-3"><Input label="Nom du site" value={siteForm.nom} onChange={set('nom')} required/><Input label="Téléphone" value={siteForm.telephone} onChange={set('telephone')}/><Input label="Adresse" value={siteForm.adresse} onChange={set('adresse')}/><Input label="Commune" value={siteForm.commune} onChange={set('commune')}/><Input label="Département" value={siteForm.departement} onChange={set('departement')}/><Input label="Email" type="email" value={siteForm.email} onChange={set('email')}/><button className="sm:col-span-2 primary flex items-center justify-center gap-2"><Plus className="w-4"/>Créer le site</button></form></Panel></>; }
function FinanceSettings({ finance, saveFinancialConfiguration }) {
  const [draft, setDraft] = useState({ fees: [], plans: [] });
  useEffect(() => {
    if (!finance) return;
    setDraft({
      fees: finance.fees.map((fee) => ({ ...fee, applicableA: fee.applicable_a, montant: String(fee.montant) })),
      plans: finance.classes.map((annualClass) => ({ classeAnnuelleId: annualClass.id, label: annualClass.code_affichage, montantTotal: annualClass.plan ? String(annualClass.plan.montant_total) : '', tranches: annualClass.plan?.tranches?.map((tranche) => ({ ...tranche, montant: String(tranche.montant), dateEcheance: tranche.date_echeance?.slice(0, 10) || '', })) || [], })),
    });
  }, [finance]);
  const setFee = (index, key, value) => setDraft({ ...draft, fees: draft.fees.map((fee, current) => current === index ? { ...fee, [key]: value } : fee) });
  const setPlan = (index, key, value) => setDraft({ ...draft, plans: draft.plans.map((plan, current) => current === index ? { ...plan, [key]: value } : plan) });
  const setTranche = (planIndex, trancheIndex, key, value) => setDraft({ ...draft, plans: draft.plans.map((plan, current) => current !== planIndex ? plan : { ...plan, tranches: plan.tranches.map((tranche, trancheCurrent) => trancheCurrent === trancheIndex ? { ...tranche, [key]: value } : tranche) }) });
  const addFee = () => setDraft({ ...draft, fees: [...draft.fees, { nom: '', montant: '', applicableA: 'les_deux', obligatoire: true, ordre: draft.fees.length, actif: true }] });
  const addTranche = (planIndex) => setDraft({ ...draft, plans: draft.plans.map((plan, current) => current !== planIndex ? plan : { ...plan, tranches: [...plan.tranches, { nom: `Tranche ${plan.tranches.length + 1}`, montant: '', dateEcheance: '', ordre: plan.tranches.length + 1, actif: true }] }) });
  const submit = (event) => { event.preventDefault(); saveFinancialConfiguration({ fees: draft.fees, plans: draft.plans }); };
  const trancheSum = (plan) => plan.tranches.reduce((sum, t) => sum + Number(t.montant || 0), 0);
const levelOf = (label) => label.split('—')[0].trim();

const applyToLevel = (planIndex) => {
  const source = draft.plans[planIndex];
  const level = levelOf(source.label);
  setDraft({
    ...draft,
    plans: draft.plans.map((plan) => {
      if (plan === source || levelOf(plan.label) !== level) return plan;
      return {
        ...plan,
        montantTotal: source.montantTotal,
        tranches: source.tranches.map(({ id, ...rest }) => ({ ...rest })),
      };
    }),
  });
};
  if (!finance?.year) return <><Title title="Paramètres financiers" subtitle="Configurez les frais et tarifs de l'année active"/><Empty>Activez d'abord une année scolaire.</Empty></>;

  return (
    <>
      <Title title="Paramètres financiers" subtitle={`Année ${finance.year.libelle} · ${finance.site.nom}`}/>
      <form onSubmit={submit}>
        <Panel title="Frais généraux" action={<button type="button" onClick={addFee} className="text-sm font-semibold text-emerald-700">+ Ajouter un frais</button>}>
          {draft.fees.length ? (
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <div className="grid grid-cols-12 gap-3 bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-500">
                <span className="col-span-4">Libellé</span>
                <span className="col-span-3">Montant (F CFA)</span>
                <span className="col-span-3">Applicable à</span>
                <span className="col-span-2">Obligatoire</span>
              </div>
              <div className="divide-y divide-slate-100">
                {draft.fees.map((fee, index) => (
                  <div key={fee.id || index} className="grid grid-cols-12 items-center gap-3 px-4 py-3">
                    <input className="input col-span-4" value={fee.nom} onChange={(event) => setFee(index, 'nom', event.target.value)} required placeholder="Ex : Inscription"/>
                    <input className="input col-span-3" type="number" min="0" step="0.01" value={fee.montant} onChange={(event) => setFee(index, 'montant', event.target.value)} required/>
                    <select className="input col-span-3" value={fee.applicableA} onChange={(event) => setFee(index, 'applicableA', event.target.value)}>
                      <option value="les_deux">Inscription et réinscription</option>
                      <option value="inscription">Inscription seulement</option>
                      <option value="reinscription">Réinscription seulement</option>
                    </select>
                    <label className="col-span-2 flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={fee.obligatoire} onChange={(event) => setFee(index, 'obligatoire', event.target.checked)}/> Oui
                    </label>
                  </div>
                ))}
              </div>
            </div>
          ) : <Empty>Aucun frais général configuré.</Empty>}
        </Panel>

        <Panel title="Tarifs par classe">
          {draft.plans.length ? (
            <div className="grid gap-4 lg:grid-cols-2">
              {draft.plans.map((plan, planIndex) => {
                const sum = trancheSum(plan);
                const total = Number(plan.montantTotal || 0);
                const balanced = plan.tranches.length > 0 && sum === total;
                return (
                  <div key={plan.classeAnnuelleId} className="rounded-xl border border-slate-200 p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <h4 className="font-semibold text-slate-800">{plan.label}</h4>
                      {plan.tranches.length > 0 && (
                        <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${balanced ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                          {balanced ? 'Tranches équilibrées' : `Écart ${money(total - sum)}`}
                        </span>
                      )}
                      {draft.plans.filter((p) => p !== plan && levelOf(p.label) === levelOf(plan.label)).length > 0 && (
                        <button
                          type="button"
                          onClick={() => applyToLevel(planIndex)}
                          disabled={!plan.montantTotal || !plan.tranches.length}
                          className="shrink-0 text-xs font-semibold text-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          Appliquer à tout le niveau
                        </button>
                      )}
                    </div>

                    <Input label="Tarif annuel (F CFA)" type="number" min="0.01" step="0.01" value={plan.montantTotal} onChange={(event) => setPlan(planIndex, 'montantTotal', event.target.value)} required/>

                    <div className="mt-4 space-y-3">
                      {plan.tranches.map((tranche, trancheIndex) => (
                        <div key={tranche.id || trancheIndex} className="grid grid-cols-3 gap-2">
                          <Input label="Tranche" value={tranche.nom} onChange={(event) => setTranche(planIndex, trancheIndex, 'nom', event.target.value)} required/>
                          <Input label="Montant" type="number" min="0.01" step="0.01" value={tranche.montant} onChange={(event) => setTranche(planIndex, trancheIndex, 'montant', event.target.value)} required/>
                          <Input label="Échéance" type="date" value={tranche.dateEcheance} onChange={(event) => setTranche(planIndex, trancheIndex, 'dateEcheance', event.target.value)} required/>
                        </div>
                      ))}
                    </div>

                    <button type="button" onClick={() => addTranche(planIndex)} className="mt-3 text-sm font-semibold text-emerald-700">+ Ajouter une tranche</button>
                  </div>
                );
              })}
            </div>
          ) : <Empty>Créez d'abord une classe annuelle.</Empty>}
        </Panel>

        <button className="primary">Enregistrer la configuration</button>
      </form>
    </>
  );
}
function SecretaryHome({ secretaryClasses, setSection, loadClass }) {
  const classes = sortClasses(secretaryClasses);
  const totalStudents = classes.reduce((total, item) => total + Number(item.effectif || 0), 0);
  const emptyClasses = classes.filter((item) => Number(item.effectif || 0) === 0).length;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Espace Secrétariat</p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">Registre scolaire</h2>
        <p className="mt-1 text-sm text-slate-500">
          Organisez les classes et maintenez les dossiers élèves à jour.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Card icon={<School />} label="Classes annuelles" value={classes.length} />
        <Card icon={<Users />} label="Élèves inscrits" value={totalStudents.toLocaleString('fr-FR')} />
        <Card icon={<School />} label="Classes sans élève" value={emptyClasses} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
            <div>
              <h3 className="font-semibold text-slate-900">Classes de l’année</h3>
              <p className="mt-1 text-xs text-slate-500">
                Sélectionnez une classe pour ouvrir son registre d’élèves.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setSection('classes')}
              className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700"
            >
              Gérer les classes
            </button>
          </div>

              {classes.length ? (
              <div className="divide-y divide-slate-100">
                {classes.slice(0, 6).map((item) => (
                  <div
                    key={item.id}
                    className="flex w-full items-center justify-between gap-4 py-4"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-800">{item.code_affichage}</p>
                      <p className="mt-1 truncate text-xs text-slate-500">
                        {item.site_nom || 'Site principal'}
                      </p>
                    </div>

                    <span className="shrink-0 rounded-lg bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-600">
                      {item.effectif || 0} élève(s)
                    </span>
                  </div>
                ))}
              </div>
            ) : (
            <div className="rounded-xl border border-dashed border-slate-200 p-5">
              <p className="text-sm font-medium text-slate-700">Aucune classe annuelle.</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                Créez les classes après l’activation de l’année scolaire par le Directeur.
              </p>
              <button
                type="button"
                onClick={() => setSection('classes')}
                className="mt-4 text-sm font-semibold text-emerald-700"
              >
                Créer une classe
              </button>
            </div>
          )}
        </section>

        <aside className="space-y-5">
          <section className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">Action principale</p>
            <h3 className="mt-2 font-semibold text-slate-900">Classes et élèves</h3>
            <p className="mt-2 text-xs leading-5 text-slate-500">
              Créez les classes, consultez le registre, corrigez une fiche ou enregistrez un transfert interne.
            </p>

            <button
              type="button"
              onClick={() => setSection('classes')}
              className="mt-5 w-full rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700"
            >
              Ouvrir le registre
            </button>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="font-semibold text-slate-900">Rôle de la Secrétaire</h3>
            <ul className="mt-4 space-y-3 text-xs leading-5 text-slate-500">
              <li>Créer et organiser les classes annuelles.</li>
              <li>Mettre à jour les informations des élèves.</li>
              <li>Enregistrer les transferts entre classes.</li>
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}
function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl" onClick={(event) => event.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-semibold text-slate-900">{title}</h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}
function ClassRegistry({ editable, secretaryClasses, censeurClasses, classDetail, loadClass, setClassDetail, classForm, setClassForm, createClass, editingStudent, setEditingStudent, updateStudent, transferStudent, setTransferStudent, moveStudent, establishmentName }) {
  const classes = editable ? secretaryClasses : censeurClasses;
  const [search, setSearch] = useState('');
  const q = search.trim();
  const visibleClasses = q ? classes.filter((item) => matchClassSearch(item, q)) : classes;
  const level = classForm.nom.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s/g, '');
  const automaticType = ['6', '6e', '6eme', '5', '5e', '5eme', '4', '4e', '4eme'].includes(level) ? 'groupe' : ['2nde', '2nd', 'seconde', '1ere', '1re', 'tle', 'terminale'].includes(level) ? 'serie' : '';
  const isThird = ['3', '3e', '3eme'].includes(level);
  const divisionType = automaticType || classForm.divisionType;
  const divisionLabel = divisionType === 'groupe' ? 'Groupe' : divisionType === 'serie' ? 'Série' : 'Groupe ou série';
  const updateName = (nom) => {
    const normalized = nom.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s/g, '');
    const automatic = ['6', '6e', '6eme', '5', '5e', '5eme', '4', '4e', '4eme'].includes(normalized) ? 'groupe' : ['2nde', '2nd', 'seconde', '1ere', '1re', 'tle', 'terminale'].includes(normalized) ? 'serie' : '';
    setClassForm({ ...classForm, nom, divisionType: ['3', '3e', '3eme'].includes(normalized) ? classForm.divisionType : automatic, divisionNom: ['3', '3e', '3eme'].includes(normalized) || automatic ? classForm.divisionNom : '' });
  };

  if (classDetail?.classInfo) return <ClassStudents {...{ editable, classes, classDetail, setClassDetail, editingStudent, setEditingStudent, updateStudent, transferStudent, setTransferStudent, moveStudent }}/>;

  return <>
    <Title title="Classes et élèves" subtitle={editable ? 'Créez une classe, puis ouvrez-la pour gérer les fiches élèves.' : 'Consultation des classes et des élèves.'}/>
    {editable && <Panel title="Créer une classe annuelle"><form onSubmit={createClass} className="grid sm:grid-cols-4 gap-3"><Input label="Classe" placeholder="6ème" value={classForm.nom} onChange={(e) => updateName(e.target.value)} required/>{automaticType && <Input label={divisionLabel} placeholder={automaticType === 'groupe' ? 'A' : 'D'} value={classForm.divisionNom} onChange={(e) => setClassForm({ ...classForm, divisionNom: e.target.value, divisionType: automaticType })}/>} {isThird && <><label className="text-sm">Type<select className="input" value={classForm.divisionType} onChange={(e) => setClassForm({ ...classForm, divisionType: e.target.value, divisionNom: '' })}><option value="">Choisir</option><option value="groupe">Groupe</option><option value="serie">Série</option></select></label><Input label={divisionLabel} placeholder="Valeur" value={classForm.divisionNom} onChange={(e) => setClassForm({ ...classForm, divisionNom: e.target.value })}/></>}<button className="primary self-end">Créer la classe</button></form>{automaticType && <p className="mt-3 text-xs text-slate-500">{automaticType === 'groupe' ? 'De la 6ème à la 4ème, la séparation est un groupe.' : 'De la 2nde à la Terminale, la séparation est une série.'}</p>}</Panel>}
    <div className="mb-4 flex items-center gap-3"><div className="relative flex-1"><Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2"/><input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher une classe, un niveau, un site" className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" /></div></div>
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">{visibleClasses.length ? <div className="divide-y divide-slate-100">{sortClasses(visibleClasses).map((item) => <button key={item.id} type="button" onClick={() => loadClass(item.id)} className="flex w-full items-center gap-4 px-4 py-3 text-left transition hover:bg-emerald-50/40"><span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${editable ? 'bg-emerald-50 text-emerald-600' : 'bg-violet-50 text-violet-600'}`}><School className="h-4 w-4" /></span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-slate-900">{item.code_affichage}</span><span className="block truncate text-xs text-slate-500">{establishmentName || item.site_nom || 'Établissement'}</span></span><span className="flex shrink-0 items-center gap-1.5 text-xs font-semibold text-slate-600"><Users className="h-3.5 w-3.5" />{item.effectif || 0} élève(s)</span><ChevronLeft className="h-4 w-4 rotate-180 text-slate-300" /></button>)}</div> : <div className="p-5"><Empty>{q ? 'Aucune classe ne correspond à la recherche.' : 'Aucune classe annuelle. Le directeur doit d’abord activer l’année scolaire.'}</Empty></div>}</div>
  </>;
}
function LegacyClassStudents({ editable, classes, classDetail, setClassDetail, editingStudent, setEditingStudent, updateStudent, transferStudent, setTransferStudent, moveStudent }) {
  const students = classDetail.students || [];
    const setEdit = (key) => (e) => setEditingStudent({ ...editingStudent, [key]: e.target.value });
  const value = (item, fallback = 'Non renseigné') => item || fallback;

  return <>
    <button onClick={() => setClassDetail(null)} className="text-sm text-emerald-700 flex gap-1 mb-4"><ChevronLeft className="w-4"/>Retour aux classes</button>
    <Title title={classDetail.classInfo.code_affichage} subtitle={`${students.length} élève(s) affecté(s) à cette classe`}/>
    {editingStudent && (
  <Modal title={`Modifier la fiche de ${editingStudent.nom} ${editingStudent.prenom}`} onClose={() => setEditingStudent(null)}>
    <form onSubmit={updateStudent} className="grid gap-3 sm:grid-cols-2">
      <Input label="Nom" value={editingStudent.nom || ''} onChange={setEdit('nom')} required/>
      <Input label="Prénom" value={editingStudent.prenom || ''} onChange={setEdit('prenom')} required/>
      <Input label="Date de naissance" type="date" value={editingStudent.date_naissance || ''} onChange={setEdit('date_naissance')}/>
      <Input label="Lieu de naissance" value={editingStudent.lieu_naissance || ''} onChange={setEdit('lieu_naissance')}/>
      <Input label="Nationalité" value={editingStudent.nationalite || ''} onChange={setEdit('nationalite')}/>
      <Input label="Téléphone parent/tuteur" value={editingStudent.telephone || ''} onChange={setEdit('telephone')}/>
      <label className="text-sm">Sexe<select value={editingStudent.sexe || ''} onChange={setEdit('sexe')} className="input"><option value="">Non renseigné</option><option value="M">Masculin</option><option value="F">Féminin</option></select></label>
      <button className="primary sm:col-span-2">Enregistrer les modifications</button>
    </form>
  </Modal>
)}
{transferStudent && (
  <Modal title={`Transférer ${transferStudent.nom} ${transferStudent.prenom}`} onClose={() => setTransferStudent(null)}>
    <form onSubmit={moveStudent} className="grid gap-3 sm:grid-cols-2">
      <label className="text-sm sm:col-span-2">Classe ou site de destination
        <select required className="input" value={transferStudent.destinationClassId || ''} onChange={(event) => setTransferStudent({ ...transferStudent, destinationClassId: event.target.value })}>
          <option value="">Choisir</option>
          {classes.filter((item) => item.id !== classDetail.classInfo.id).map((item) => <option key={item.id} value={item.id}>{item.code_affichage}{item.site_nom ? ` — ${item.site_nom}` : ''}</option>)}
        </select>
      </label>
      <button className="primary sm:col-span-2">Confirmer le transfert</button>
    </form>
  </Modal>
)}
    <Panel title="Liste des élèves">{students.length ? <div className="overflow-x-auto rounded-xl border border-slate-200"><table className="w-full min-w-[980px] border-collapse text-left"><thead className="bg-slate-50"><tr className="border-b border-slate-200 text-xs font-semibold text-slate-500"><th className="px-4 py-4">Matricule</th><th className="px-4 py-4">Nom</th><th className="px-4 py-4">Prénom(s)</th><th className="px-4 py-4">Sexe</th><th className="px-4 py-4">Date et lieu de naissance</th><th className="px-4 py-4">Téléphone parent/tuteur</th><th className="px-4 py-4">Photo</th><th className="px-4 py-4 text-right">Actions</th></tr></thead><tbody className="divide-y divide-slate-100">{students.map((student) => <tr key={student.id} className="text-sm text-slate-700 hover:bg-slate-50/70"><td className="whitespace-nowrap px-4 py-5 font-medium text-slate-900">{value(student.matricule)}</td><td className="whitespace-nowrap px-4 py-5 font-semibold text-slate-900">{value(student.nom)}</td><td className="whitespace-nowrap px-4 py-5">{value(student.prenom)}</td><td className="px-4 py-5">{value(student.sexe)}</td><td className="whitespace-nowrap px-4 py-5">{value(student.date_naissance)}{student.lieu_naissance ? ` · ${student.lieu_naissance}` : ''}</td><td className="whitespace-nowrap px-4 py-5">{value(student.telephone)}</td><td className="px-4 py-5"><span className="rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">OK</span></td><td className="px-4 py-5"><div className="flex justify-end gap-3">{editable && <><button type="button" title="Modifier" onClick={() => setEditingStudent({ ...student })} className="text-slate-400 transition hover:text-emerald-600"><Pencil className="h-4 w-4"/></button><button type="button" title="Transférer" onClick={() => setTransferStudent({ ...student, destinationClassId: '' })} className="text-xs font-medium text-slate-500 hover:text-slate-800">Transférer</button></>}</div></td></tr>)}</tbody></table></div> : <Empty>Aucun élève dans cette classe.</Empty>}</Panel>
  </>;
}
function ClassStudents({ editable, classes, classDetail, setClassDetail, editingStudent, setEditingStudent, updateStudent, transferStudent, setTransferStudent, moveStudent }) {
  const students = classDetail.students || [];
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const visibleStudents = search.trim() ? students.filter((student) => matchStudentSearch(student, search)) : students;
  const totalPages = Math.max(1, Math.ceil(visibleStudents.length / pageSize));
  const pageStudents = visibleStudents.slice((page - 1) * pageSize, page * pageSize);
  const value = (item, fallback = 'Non renseigné') => item || fallback;
  const setEdit = (key) => (event) => setEditingStudent({ ...editingStudent, [key]: event.target.value });

  useEffect(() => { setPage(1); }, [search]);

  return <>
    <button onClick={() => setClassDetail(null)} className="mb-4 flex gap-1 text-sm text-emerald-700"><ChevronLeft className="w-4"/>Retour aux classes</button>
    <Title title={classDetail.classInfo.code_affichage} subtitle={`${students.length} élève(s) affecté(s) à cette classe`}/>

    {editingStudent && (
      <Modal title={`Modifier la fiche de ${editingStudent.nom} ${editingStudent.prenom}`} onClose={() => setEditingStudent(null)}>
        <form onSubmit={updateStudent} className="grid gap-3 sm:grid-cols-2">
          <Input label="Nom" value={editingStudent.nom || ''} onChange={setEdit('nom')} required/>
          <Input label="Prénom" value={editingStudent.prenom || ''} onChange={setEdit('prenom')} required/>
          <Input label="Date de naissance" type="date" value={editingStudent.date_naissance || ''} onChange={setEdit('date_naissance')}/>
          <Input label="Lieu de naissance" value={editingStudent.lieu_naissance || ''} onChange={setEdit('lieu_naissance')}/>
          <Input label="Nationalité" value={editingStudent.nationalite || ''} onChange={setEdit('nationalite')}/>
          <Input label="Téléphone parent/tuteur" value={editingStudent.telephone || ''} onChange={setEdit('telephone')}/>
          <label className="text-sm">Sexe<select value={editingStudent.sexe || ''} onChange={setEdit('sexe')} className="input"><option value="">Non renseigné</option><option value="M">Masculin</option><option value="F">Féminin</option></select></label>
          <button className="primary sm:col-span-2">Enregistrer les modifications</button>
        </form>
      </Modal>
    )}

    {transferStudent && (
      <Modal title={`Transférer ${transferStudent.nom} ${transferStudent.prenom}`} onClose={() => setTransferStudent(null)}>
        <form onSubmit={moveStudent} className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm sm:col-span-2">Classe ou site de destination
            <select required className="input" value={transferStudent.destinationClassId || ''} onChange={(event) => setTransferStudent({ ...transferStudent, destinationClassId: event.target.value })}>
              <option value="">Choisir</option>
              {classes.filter((item) => item.id !== classDetail.classInfo.id).map((item) => <option key={item.id} value={item.id}>{item.code_affichage}{item.site_nom ? ` — ${item.site_nom}` : ''}</option>)}
            </select>
          </label>
          <button className="primary sm:col-span-2">Confirmer le transfert</button>
        </form>
      </Modal>
    )}

    <div className="mb-4 flex items-center gap-3">
      <div className="relative">
        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2"/>
        <input type="text" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Rechercher un élève (matricule, nom, téléphone...)" className="w-72 pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
      </div>
    </div>

    <Panel title="Liste des élèves">
      {pageStudents.length ? (
        <>
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full table-fixed border-collapse text-left text-xs">
              <colgroup>
                <col className="w-[12%]" /><col className="w-[14%]" /><col className="w-[16%]" /><col className="w-[8%]" /><col className="w-[16%]" /><col className="w-[12%]" /><col className="w-[14%]" /><col className="w-[8%]" />
              </colgroup>
              <thead className="bg-slate-50">
                <tr className="border-b border-slate-200 font-semibold text-slate-500">
                  <th className="px-3 py-2">Matricule</th>
                  <th className="px-3 py-2">Nom</th>
                  <th className="px-3 py-2">Prénom(s)</th>
                  <th className="px-3 py-2">Sexe</th>
                  <th className="px-3 py-2">Naissance</th>
                  <th className="px-3 py-2">Nationalité</th>
                  <th className="px-3 py-2">Téléphone</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pageStudents.map((student) => (
                  <tr key={student.id} className="text-slate-700 hover:bg-slate-50/70">
                    <td className="truncate px-3 py-2 font-medium text-slate-900">{value(student.matricule)}</td>
                    <td className="truncate px-3 py-2 font-semibold text-slate-900">{value(student.nom)}</td>
                    <td className="truncate px-3 py-2">{value(student.prenom)}</td>
                    <td className="px-3 py-2">{value(student.sexe)}</td>
                    <td className="truncate px-3 py-2">{value(student.date_naissance)}{student.lieu_naissance ? ` · ${student.lieu_naissance}` : ''}</td>
                    <td className="truncate px-3 py-2">{value(student.nationalite)}</td>
                    <td className="truncate px-3 py-2">{value(student.telephone)}</td>
                    <td className="px-3 py-2">
                      <div className="flex justify-end gap-3">
                        {editable && <>
                          <button type="button" title="Modifier" onClick={() => setEditingStudent({ ...student })} className="text-slate-400 transition hover:text-emerald-600"><Pencil className="h-4 w-4"/></button>
                          <button type="button" title="Transférer" onClick={() => setTransferStudent({ ...student, destinationClassId: '' })} className="text-xs font-medium text-slate-500 hover:text-slate-800">Transférer</button>
                        </>}
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
              <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">
                <ChevronLeft className="h-3.5 w-3.5" />Précédent
              </button>
              <button type="button" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">
                Suivant<ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </>
      ) : <Empty>{search.trim() ? 'Aucun élève ne correspond à la recherche.' : 'Aucun élève dans cette classe.'}</Empty>}
    </Panel>
  </>;
}
function Accountant({ cash, paymentOptions = [], createPayment, setSection }) {
  const [studentId, setStudentId] = useState('');
  const [modePaiement, setModePaiement] = useState('especes');
  const [montantRemis, setMontantRemis] = useState('');
  const [referencePaiement, setReferencePaiement] = useState('');
  const [allocations, setAllocations] = useState({});

  const student = paymentOptions.find((item) => item.inscriptionId === studentId);
  const total = Object.values(allocations).reduce((sum, value) => sum + Number(value || 0), 0);

  const setAllocation = (id, value) => {
    setAllocations({ ...allocations, [id]: value });
  };

  const submit = (event) => {
    event.preventDefault();

    createPayment({
      inscriptionId: studentId,
      modePaiement,
      montantRemis: modePaiement === 'especes' ? montantRemis : total,
      referencePaiement,
      allocations: Object.entries(allocations)
        .filter(([, value]) => Number(value) > 0)
        .map(([obligationId, montant]) => ({ obligationId, montant })),
    });

    setAllocations({});
    setMontantRemis('');
    setReferencePaiement('');
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
          Espace Comptabilité
        </p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
          Caisse et inscriptions
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Enregistrez les inscriptions, encaissements et frais scolaires.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Card icon={<Banknote />} label="Encaissements du jour" value={money(cash?.today?.total)} />
        <Card icon={<Users />} label="Inscriptions actives" value={cash?.enrolledStudents || 0} />
        <Card icon={<CalendarDays />} label="Année active" value={cash?.activeYear?.libelle || 'Non configurée'} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-5">
            <h3 className="font-semibold text-slate-900">Enregistrer un paiement</h3>
            <p className="mt-1 text-xs text-slate-500">
              Sélectionnez l’élève, les frais concernés et le moyen de paiement.
            </p>
          </div>

          <form onSubmit={submit} className="space-y-5">
            <label className="block text-sm font-medium text-slate-700">
              Élève
              <select
                className="input"
                required
                value={studentId}
                onChange={(event) => {
                  setStudentId(event.target.value);
                  setAllocations({});
                }}
              >
                <option value="">Choisir un élève</option>
                {paymentOptions.map((item) => (
                  <option key={item.inscriptionId} value={item.inscriptionId}>
                    {item.nom} {item.prenom} · {item.classe}
                  </option>
                ))}
              </select>
            </label>

            {student && (
              <>
                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="font-semibold text-slate-800">{student.nom} {student.prenom}</p>
                  <p className="mt-1 text-xs text-slate-500">{student.matricule} · {student.classe}</p>
                </div>

                <div className="space-y-3">
                  {(student.obligations || []).filter((obligation) => obligation.reste > 0).map((obligation) => (
                    <div key={obligation.id} className="grid gap-3 border-b border-slate-100 pb-4 sm:grid-cols-[minmax(0,1fr)_180px] sm:items-end">
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{obligation.libelle}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          Reste : {money(obligation.reste)}
                          {obligation.dateEcheance ? ` · Échéance ${obligation.dateEcheance}` : ''}
                        </p>
                      </div>

                      <Input
                        label="Montant reçu"
                        type="number"
                        min="0"
                        max={obligation.reste}
                        step="0.01"
                        value={allocations[obligation.id] || ''}
                        onChange={(event) => setAllocation(obligation.id, event.target.value)}
                      />
                    </div>
                  ))}
                </div>

                <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Total à enregistrer</p>
                  <p className="mt-1 text-xl font-semibold text-slate-900">{money(total)}</p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block text-sm font-medium text-slate-700">
                    Moyen de paiement
                    <select className="input" value={modePaiement} onChange={(event) => setModePaiement(event.target.value)}>
                      <option value="especes">Espèces</option>
                      <option value="mobilemoney_banque">Mobile Money / banque</option>
                    </select>
                  </label>

                  {modePaiement === 'especes' ? (
                    <Input
                      label="Montant remis"
                      type="number"
                      min={total}
                      step="0.01"
                      value={montantRemis}
                      onChange={(event) => setMontantRemis(event.target.value)}
                      required
                    />
                  ) : (
                    <Input
                      label="Référence de paiement"
                      value={referencePaiement}
                      onChange={(event) => setReferencePaiement(event.target.value)}
                    />
                  )}
                </div>

                <button
                  className="w-full rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={!total}
                >
                  Enregistrer et télécharger le reçu
                </button>
              </>
            )}
          </form>
        </section>

        <aside className="space-y-5">
          <section className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">Opérations</p>
            <h3 className="mt-2 font-semibold text-slate-900">Gestion des inscriptions</h3>
            <p className="mt-2 text-xs leading-5 text-slate-500">
              Enregistrez une inscription, une réinscription ou importez un fichier Excel.
            </p>

            <button
              type="button"
              onClick={() => setSection('inscriptions')}
              className="mt-5 w-full rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700"
            >
              Ouvrir les inscriptions
            </button>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="font-semibold text-slate-900">Configuration des frais</h3>
            <p className="mt-2 text-xs leading-5 text-slate-500">
              Définissez les frais généraux, tranches et échéances de l’année scolaire.
            </p>

            <button
              type="button"
              onClick={() => setSection('finances')}
              className="mt-5 text-sm font-semibold text-emerald-700"
            >
              Gérer les frais
            </button>
          </section>
        </aside>
      </div>
    </div>
  );
}
function Enroll({ enrollOptions, enrollForm, setEnrollForm, createEnrollment }) { const isNew = enrollForm.type === 'inscription'; const set = (key) => (e) => setEnrollForm({ ...enrollForm, [key]: e.target.value }); return <><Title title="Inscriptions et réinscriptions" subtitle={enrollOptions?.year ? `Année ${enrollOptions.year.libelle}` : 'Aucune année active'}/><Panel title="Enregistrer une inscription">{!enrollOptions?.year ? <Empty>Le directeur doit activer l'année scolaire.</Empty> : !enrollOptions.classes.length ? <Empty>La secrétaire doit créer les classes annuelles.</Empty> : <form onSubmit={createEnrollment} className="grid sm:grid-cols-2 gap-3"><label className="text-sm">Opération<select className="input" value={enrollForm.type} onChange={set('type')}><option value="inscription">Nouvelle inscription</option><option value="reinscription">Réinscription</option></select></label><label className="text-sm">Classe<select required className="input" value={enrollForm.annualClassId} onChange={set('annualClassId')}><option value="">Choisir</option>{enrollOptions.classes.map((c) => <option key={c.id} value={c.id}>{c.code_affichage}</option>)}</select></label>{isNew ? <><Input label="Matricule national" value={enrollForm.matricule} onChange={set('matricule')} required/><Input label="Nom" value={enrollForm.nom} onChange={set('nom')} required/><Input label="Prénom" value={enrollForm.prenom} onChange={set('prenom')} required/><Input label="Date de naissance" type="date" value={enrollForm.date_naissance} onChange={set('date_naissance')}/><Input label="Lieu de naissance" value={enrollForm.lieu_naissance} onChange={set('lieu_naissance')}/><Input label="Nationalité" value={enrollForm.nationalite} onChange={set('nationalite')}/><Input label="Téléphone parent/tuteur" value={enrollForm.telephone} onChange={set('telephone')}/><label className="text-sm">Sexe<select className="input" value={enrollForm.sexe} onChange={set('sexe')}><option value="">Non renseigné</option><option value="M">Masculin</option><option value="F">Féminin</option></select></label></> : <label className="text-sm sm:col-span-2">Élève déjà enregistré<select required className="input" value={enrollForm.studentId} onChange={set('studentId')}><option value="">Choisir</option>{enrollOptions.students.map((s) => <option key={s.id} value={s.id}>{s.matricule} — {s.nom} {s.prenom}</option>)}</select></label>}<button className="sm:col-span-2 primary">Valider l'opération</button></form>}</Panel></>; }
function Monitoring({ monitoring, setSection }) {
  const totals = monitoring?.totals || {};
  const activeYear = monitoring?.activeYear?.libelle || 'Non configurée';

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-700">
          Espace Censeur
        </p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
          Suivi pédagogique
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Consultez les effectifs, les classes et l’organisation pédagogique.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card icon={<Users />} label="Élèves actifs" value={totals.actifs || 0} />
        <Card icon={<Users />} label="Transferts" value={totals.transferes || 0} />
        <Card icon={<Users />} label="Renvois" value={totals.renvoyes || 0} />
        <Card icon={<School />} label="Classes actives" value={monitoring?.classes?.length || 0} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
            <div>
              <h3 className="font-semibold text-slate-900">Classes et effectifs</h3>
              <p className="mt-1 text-xs text-slate-500">
                Année scolaire : {activeYear}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setSection('classes')}
              className="rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-violet-700"
            >
              Consulter les classes
            </button>
          </div>

          {monitoring?.classes?.length ? (
            <div className="divide-y divide-slate-100">
              {sortClasses(monitoring.classes).slice(0, 6).map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-4 py-4">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-800">{item.code_affichage}</p>
                    <p className="mt-1 truncate text-xs text-slate-500">
                      {item.site_nom || 'Site principal'}
                    </p>
                  </div>

                  <span className="shrink-0 rounded-lg bg-violet-50 px-3 py-2 text-xs font-semibold text-violet-700">
                    {item.effectif || 0} élève(s)
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-200 p-5">
              <p className="text-sm text-slate-500">
                Aucune classe active pour cette année scolaire.
              </p>
            </div>
          )}
        </section>

        <aside className="space-y-5">
          <section className="rounded-2xl border border-violet-100 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-violet-700">
              Pédagogie
            </p>
            <h3 className="mt-2 font-semibold text-slate-900">
              Équipe pédagogique
            </h3>
            <p className="mt-2 text-xs leading-5 text-slate-500">
              Enregistrez les professeurs, les matières et leurs affectations par classe.
            </p>

            <button
              type="button"
              onClick={() => setSection('pedagogie')}
              className="mt-5 w-full rounded-lg bg-violet-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-violet-700"
            >
              Gérer l’équipe pédagogique
            </button>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="font-semibold text-slate-900">Accès consultation</h3>
            <p className="mt-2 text-xs leading-5 text-slate-500">
              Le Censeur consulte les élèves et les classes.
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}
function Profile({ profile, setProfile, edit, setEdit, save, username, usernameLocked }) {
  const set = (key) => (event) => setProfile({ ...profile, [key]: event.target.value });
  const [usernameDraft, setUsernameDraft] = useState(username || '');
  useEffect(() => { setUsernameDraft(username || ''); }, [username, edit]);

  const submit = (event) => {
    event.preventDefault();
    const wantsChange = !usernameLocked && usernameDraft.trim() && usernameDraft.trim() !== username;
    if (wantsChange && !window.confirm(`Définir « ${usernameDraft.trim()} » comme identifiant ? Cette action est définitive : vous ne pourrez plus le modifier ensuite.`)) return;
    save(event, wantsChange ? usernameDraft.trim() : undefined);
  };

  return <><Title title="Mon profil" subtitle="Consultez et mettez à jour vos informations personnelles"/><Panel title="Informations personnelles" action={!edit && <button type="button" onClick={() => setEdit(true)} className="text-sm font-semibold text-emerald-700">Modifier</button>}>{edit ? <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2"><Input label="Nom" value={profile.nom} onChange={set('nom')} required/><Input label="Prénom" value={profile.prenom} onChange={set('prenom')} required/><Input label="Email" type="email" value={profile.email} onChange={set('email')} required/><Input label="Téléphone" value={profile.telephone} onChange={set('telephone')}/>{!usernameLocked && <div className="sm:col-span-2"><Input label="Identifiant" value={usernameDraft} onChange={(e) => setUsernameDraft(e.target.value)}/><p className="mt-1 text-xs text-amber-700">Vous pouvez modifier votre identifiant une seule fois. Une fois confirmé, il ne pourra plus être changé.</p></div>}<div className="flex gap-2 sm:col-span-2"><button className="primary">Enregistrer</button><button type="button" onClick={() => setEdit(false)} className="rounded-lg bg-slate-100 px-4 py-2.5 text-sm text-slate-700">Annuler</button></div></form> : <dl className="grid gap-4 text-sm sm:grid-cols-2"><Detail label="Nom" value={`${profile.prenom} ${profile.nom}`.trim() || 'Non renseigné'}/><Detail label="Identifiant" value={username || 'Non renseigné'}/><Detail label="Email" value={profile.email || 'Non renseigné'}/><Detail label="Téléphone" value={profile.telephone || 'Non renseigné'}/></dl>}</Panel></>;
}
function Security({ password, setPassword, save }) { const set = (key) => (e) => setPassword({ ...password, [key]: e.target.value }); return <><Title title="Sécurité" subtitle="Modifiez votre mot de passe à tout moment"/><Panel title="Modifier mon mot de passe"><form onSubmit={save} className="grid sm:grid-cols-2 gap-3"><Input label="Mot de passe actuel" type="password" value={password.currentPassword} onChange={set('currentPassword')} required/><div/><Input label="Nouveau mot de passe" type="password" value={password.newPassword} onChange={set('newPassword')} required/><Input label="Confirmer le nouveau mot de passe" type="password" value={password.confirmPassword} onChange={set('confirmPassword')} required/><button className="sm:col-span-2 bg-slate-800 text-white rounded-lg p-2.5 text-sm">Modifier le mot de passe</button></form></Panel></>; }
function Title({ title, subtitle }) { return <div className="mb-6"><h2 className="text-2xl font-semibold">{title}</h2><p className="text-sm text-slate-500 mt-1">{subtitle}</p></div>; } function Panel({ title, action, children }) { return <section className="bg-white border rounded-xl p-6 mb-5"><div className="flex justify-between mb-5"><h3 className="font-semibold">{title}</h3>{action}</div>{children}</section>; } function Card({ icon, label, value, children }) { return <div className="bg-white border rounded-xl p-4"><div className="text-emerald-600 mb-3 w-5">{icon}</div><p className="text-xs text-slate-500">{label}</p><p className="font-semibold mt-1 truncate">{value}</p>{children}</div>; } function Input({ label, ...props }) { return <label className="block text-sm">{label}<input {...props} className="input"/></label>; } function Detail({ label, value }) { return <div><dt className="text-slate-500">{label}</dt><dd className="font-medium mt-1">{value}</dd></div>; } function Empty({ children }) { return <p className="text-sm text-slate-500">{children}</p>; } function Notice({ type = 'warning', children }) { const style = type === 'error' ? 'bg-rose-50 border-rose-200 text-rose-700' : type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-amber-50 border-amber-200 text-amber-800'; return <div className={`max-w-6xl mx-auto mb-5 p-4 border rounded-xl text-sm ${style}`}>{children}</div>; }

