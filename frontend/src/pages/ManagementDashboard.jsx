import { useEffect, useState } from 'react';
import { AlertTriangle, Banknote, CalendarDays, ChevronLeft, ChevronRight, MapPin, Pencil, Plus, School, Search, Users } from 'lucide-react';
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
import FinanceOverview, { HistoryPanel, OverdueInstallmentsPanel } from './FinanceOverview';


const money = (value) => `${Number(value || 0).toLocaleString('fr-FR')} F CFA`;
const blankStudent = { matricule: '', nom: '', prenom: '', sexe: '', date_naissance: '', lieu_naissance: '', nationalite: '', telephone: '' };
const classRank = (value = '') => { const level = value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); const found = level.match(/(?:^|\s)(6|5|4|3)(?:e|eme)?|(?:^|\s)(2nde|2nd|seconde|1ere|1re|tle|terminale)/); const key = found?.[1] || found?.[2] || ''; return ({ 6: 1, 5: 2, 4: 3, 3: 4, '2nde': 5, '2nd': 5, seconde: 5, '1ere': 6, '1re': 6, tle: 7, terminale: 7 })[key] || 99; };
const sortClasses = (classes = []) => [...classes].sort((a, b) => { const rank = classRank(a.code_affichage) - classRank(b.code_affichage); return rank || a.code_affichage.localeCompare(b.code_affichage, 'fr', { numeric: true, sensitivity: 'base' }); });
const classLevelCode = (value = '') => { const normalized = value.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s/g, ''); if (['6', '6e', '6eme'].includes(normalized)) return '6e'; if (['5', '5e', '5eme'].includes(normalized)) return '5e'; if (['4', '4e', '4eme'].includes(normalized)) return '4e'; if (['3', '3e', '3eme'].includes(normalized)) return '3e'; if (['2nde', '2nd', 'seconde'].includes(normalized)) return '2nde'; if (['1ere', '1re'].includes(normalized)) return '1ere'; if (['tle', 'terminale', 'term'].includes(normalized)) return 'terminale'; return ''; };

export default function ManagementDashboard({ onLogout }) {
  const [user, setUser] = useState(null); const [section, setSection] = useState('tableau'); const [loading, setLoading] = useState(true);
  const [financeRefreshKey, setFinanceRefreshKey] = useState(0);
  const [notice, setNotice] = useState(''); const [error, setError] = useState(''); const [profileEdit, setProfileEdit] = useState(false);
  const [profile, setProfile] = useState({ nom: '', prenom: '', email: '', telephone: '' }); const [password, setPassword] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [direction, setDirection] = useState(null); const [establishmentName, setEstablishmentName] = useState(''); const [secretaryClasses, setSecretaryClasses] = useState([]); const [censeurClasses, setCenseurClasses] = useState([]); const [classDetail, setClassDetail] = useState(null);
  const [cash, setCash] = useState(null); const [enrollOptions, setEnrollOptions] = useState(null); const [paymentOptions, setPaymentOptions] = useState([]); const [monitoring, setMonitoring] = useState(null); const [finance, setFinance] = useState(null); const [censeurProfessors, setCenseurProfessors] = useState([]); const [censeurSubjects, setCenseurSubjects] = useState([]);
  const [schoolYears, setSchoolYears] = useState([]); const [yearForm, setYearForm] = useState({ libelle: '', dateDebut: '', dateFin: '' }); const [siteForm, setSiteForm] = useState({ nom: '', adresse: '', commune: '', departement: '', telephone: '', email: '' }); const [classForm, setClassForm] = useState({ nom: '', divisionNom: '', divisionType: '' });
  const [editingStudent, setEditingStudent] = useState(null); const [transferStudent, setTransferStudent] = useState(null);
  const [enrollForm, setEnrollForm] = useState({ type: 'inscription', studentId: '', annualClassId: '', paidFeeConfigIds: [], ...blankStudent });
  const refresh = async (role) => { if (role === 'directeur') { const [overview, years] = await Promise.all([directionAPI.overview(), directionAPI.listSchoolYears()]); setDirection(overview.data); setSchoolYears(years.data?.annees || []); } if (role === 'secretaire') setSecretaryClasses((await secretariatAPI.listClasses()).data?.classes || []); if (role === 'comptable') { const [cashData, enrollmentData, paymentData, financialConfiguration] = await Promise.all([comptabiliteAPI.cashOverview(), comptabiliteAPI.enrollmentOptions(), comptabiliteAPI.paymentOptions(), comptabiliteAPI.financialConfiguration()]); const enrollment = enrollmentData.data || {}; const financial = financialConfiguration.data || {}; setCash(cashData.data || null); setEnrollOptions({ ...enrollment, classes: Array.isArray(enrollment.classes) ? enrollment.classes : [], students: Array.isArray(enrollment.students) ? enrollment.students : [] }); setPaymentOptions(Array.isArray(paymentData.data?.students) ? paymentData.data.students : []); setFinance({ ...financial, fees: Array.isArray(financial.fees) ? financial.fees : [], classes: Array.isArray(financial.classes) ? financial.classes : [] }); } if (role === 'censeur') { const [monitoringData, classesData, professorsData, subjectsData] = await Promise.all([censeurAPI.overview(), censeurAPI.listClasses(), censeurAPI.listProfessors(), censeurAPI.listSubjects()]); setMonitoring(monitoringData.data); setCenseurClasses(classesData.data?.classes || []); setCenseurProfessors(professorsData.data?.professeurs || []); setCenseurSubjects(subjectsData.data?.matieres || []); } };
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
 const createNextYear = (event) => { event.preventDefault(); action(() => directionAPI.createSchoolYear(yearForm), 'Brouillon créé : la configuration de l’année précédente a été copiée.', async () => setYearForm({ libelle: '', dateDebut: '', dateFin: '' })); };
  const activateYear = (id) => action(() => directionAPI.activateSchoolYear(id), 'Nouvelle année scolaire activée.');
  const closeYear = (id) => action(() => directionAPI.closeSchoolYear(id), 'Année scolaire clôturée.');
  const createSite = (event) => { event.preventDefault(); action(() => directionAPI.createSite(siteForm), 'Nouveau site créé.', async () => setSiteForm({ nom: '', adresse: '', commune: '', departement: '', telephone: '', email: '' })); };
  const saveFinancialConfiguration = (payload) => action(() => comptabiliteAPI.saveFinancialConfiguration(payload), 'Configuration financière enregistrée.');
  const createClass = (event) => { event.preventDefault(); const niveauCode = classLevelCode(classForm.nom); const divisionType = classForm.divisionType || (['6e', '5e', '4e'].includes(niveauCode) ? 'groupe' : ['2nde', '1ere', 'terminale'].includes(niveauCode) ? 'serie' : ''); if (!niveauCode) return setError('Choisissez un niveau valide : 6ème, 5ème, 4ème, 3ème, 2nde, 1ère ou Terminale.'); if (!classForm.divisionNom?.trim() || !divisionType) return setError('Indiquez le groupe ou la série de la classe.'); action(() => secretariatAPI.createClass({ niveauCode, divisionNom: classForm.divisionNom.trim(), divisionType }), 'Classe annuelle créée.', async () => setClassForm({ nom: '', divisionNom: '', divisionType: '' })); };
  const updateStudent = (event) => { event.preventDefault(); action(() => secretariatAPI.updateStudent(editingStudent.id, editingStudent), 'Informations de l’élève mises à jour.', async () => { const id = classDetail.classInfo.id; setEditingStudent(null); await loadClass(id); }); };
  const moveStudent = (event) => { event.preventDefault(); action(() => secretariatAPI.transferStudent(transferStudent.id, transferStudent.destinationClassId), 'Transfert interne enregistré.', async () => { const id = classDetail.classInfo.id; setTransferStudent(null); await loadClass(id); }); };
  const createEnrollment = (event) => {
    event.preventDefault();
    const generalFees = (finance?.fees || []).filter((fee) => fee.actif && fee.obligatoire && (fee.applicable_a === enrollForm.type || fee.applicable_a === 'les_deux'));
    const missing = generalFees.filter((fee) => !(enrollForm.paidFeeConfigIds || []).includes(fee.id));
    if (missing.length && !window.confirm(`${missing.length} frais général(aux) obligatoire(s) non coché(s) comme soldé(s). Confirmer l'opération quand même ? Ils devront être réglés en caisse.`)) return;
    const payload = enrollForm.type === 'reinscription' ? { type: 'reinscription', studentId: enrollForm.studentId, annualClassId: enrollForm.annualClassId, paidFeeConfigIds: enrollForm.paidFeeConfigIds || [] } : { ...enrollForm };
    action(() => comptabiliteAPI.createEnrollment(payload), 'Inscription enregistrée. Les effectifs sont actualisés immédiatement.', async () => setEnrollForm({ type: 'inscription', studentId: '', annualClassId: '', paidFeeConfigIds: [], ...blankStudent }));
  };
const createPayment = async (payload, studentLabel) => {
  setError(''); setNotice('');
  try {
    await comptabiliteAPI.createPayment(payload);
    setNotice(`Paiement enregistré pour ${studentLabel || "l'élève sélectionné"}.`);
    await refresh(user.role);
    setFinanceRefreshKey((k) => k + 1);
  } catch (err) { setError(err.response?.data?.error || 'Paiement impossible.'); }
};
  if (loading) return <main className="min-h-screen grid place-items-center bg-slate-50 text-slate-500">Chargement...</main>;
  const content = section === 'profil' ? <Profile profile={profile} setProfile={setProfile} edit={profileEdit} setEdit={setProfileEdit} save={saveProfile} username={user.username}/> : section === 'securite' ? <Security password={password} setPassword={setPassword} save={savePassword}/> : <RoleContent {...{ role: user.role, section, setSection, direction, establishmentName, finance, saveFinancialConfiguration, secretaryClasses, censeurClasses, classDetail, loadClass, setClassDetail, classForm, setClassForm, createClass, yearForm, setYearForm, createYear, editingStudent, setEditingStudent, updateStudent, transferStudent, setTransferStudent, moveStudent, cash, enrollOptions, enrollForm, setEnrollForm, createEnrollment, paymentOptions, createPayment, monitoring,financeRefreshKey}}/>;
  if (user.role === 'directeur') return <DirectorWorkspace user={user} establishmentName={establishmentName} onLogout={onLogout} section={section} setSection={setSection} content={content} error={error} notice={notice} cockpitProps={{ direction, schoolYears, yearForm, setYearForm, createYear, createNextYear, activateYear, closeYear }} />;
  return <ManagementWorkspace role={user.role} user={user} establishmentName={establishmentName} section={section} setSection={setSection} onLogout={onLogout} content={content} error={error} notice={notice} />;
}

function RoleContent(props) { if (props.role === 'directeur') return props.section === 'assistance' ? <AssistancePanel user={props.user} establishmentName={props.establishmentName}/> : <DirectorCockpit {...props}/>; const view = props.role === 'secretaire' ? (props.section === 'classes' ? <ClassRegistry {...props} editable/> : props.section === 'assistance' ? <AssistancePanel user={props.user} establishmentName={props.establishmentName}/> : <SecretaryHome {...props}/>) : props.role === 'comptable' ? (
  props.section === 'inscriptions' ? <><Enroll {...props}/><StudentImportPanel/></>
  : props.section === 'finances' ? <FinanceSettings {...props}/>
  : props.section === 'caisse' ? <Accountant {...props}/>
  : props.section === 'historique' ? <HistoryPanel key={props.financeRefreshKey} />
  : props.section === 'assistance' ? <AssistancePanel user={props.user} establishmentName={props.establishmentName}/>
  : props.section === 'echeances' ? <OverdueInstallmentsPanel/>
  : <FinanceOverview key={props.financeRefreshKey} />
) : props.role === 'censeur' ? (props.section === 'classes' ? <ClassRegistry {...props}/> : props.section === 'pedagogie' ? <CenseurPedagogy/> : props.section === 'assistance' ? <AssistancePanel user={props.user} establishmentName={props.establishmentName}/> : <Monitoring {...props}/>) : null; return view; }
function Sites({ direction, siteForm, setSiteForm, createSite }) { const set = (key) => (event) => setSiteForm({ ...siteForm, [key]: event.target.value }); return <><Title title="Sites et filiales" subtitle="Le site principal est créé à l�?Tinstallation. Ajoutez une filiale seulement si elle partage le même établissement."/><div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">{direction?.sites?.map((site) => <Card key={site.id} icon={<MapPin/>} label={site.est_principal ? 'Site principal' : 'Filiale'} value={site.nom}><p className="text-xs text-slate-500 mt-3">{site.classes_count} classe(s) · {site.students_count} élève(s)</p></Card>)}</div><Panel title="Ajouter un site"><form onSubmit={createSite} className="grid sm:grid-cols-2 gap-3"><Input label="Nom du site" value={siteForm.nom} onChange={set('nom')} required/><Input label="Téléphone" value={siteForm.telephone} onChange={set('telephone')}/><Input label="Adresse" value={siteForm.adresse} onChange={set('adresse')}/><Input label="Commune" value={siteForm.commune} onChange={set('commune')}/><Input label="Département" value={siteForm.departement} onChange={set('departement')}/><Input label="Email" type="email" value={siteForm.email} onChange={set('email')}/><button className="sm:col-span-2 primary flex items-center justify-center gap-2"><Plus className="w-4"/>Créer le site</button></form></Panel></>; }
function FinanceSettings({ finance, saveFinancialConfiguration }) {
  const [draft, setDraft] = useState({ fees: [], plans: [] });
  const [mode, setMode] = useState('view');
  const [classSearch, setClassSearch] = useState('');

  useEffect(() => {
    if (!finance) return;
    const fees = finance.fees.map((fee) => ({ ...fee, applicableA: fee.applicable_a, montant: String(fee.montant) }));
    const plans = finance.classes.map((annualClass) => ({
      classeAnnuelleId: annualClass.id,
      label: annualClass.code_affichage,
      montantTotal: annualClass.plan ? String(annualClass.plan.montant_total) : '',
      tranches: annualClass.plan?.tranches?.map((tranche) => ({ ...tranche, montant: String(tranche.montant), dateEcheance: tranche.date_echeance?.slice(0, 10) || '' })) || [],
    }));
    setDraft({ fees, plans });
    setMode(fees.length > 0 || plans.some((p) => p.montantTotal) ? 'view' : 'edit');
  }, [finance]);

  const setFee = (index, key, value) => setDraft({ ...draft, fees: draft.fees.map((fee, current) => current === index ? { ...fee, [key]: value } : fee) });
  const setPlan = (index, key, value) => setDraft({ ...draft, plans: draft.plans.map((plan, current) => current === index ? { ...plan, [key]: value } : plan) });
  const setTranche = (planIndex, trancheIndex, key, value) => setDraft({ ...draft, plans: draft.plans.map((plan, current) => current !== planIndex ? plan : { ...plan, tranches: plan.tranches.map((tranche, trancheCurrent) => trancheCurrent === trancheIndex ? { ...tranche, [key]: value } : tranche) }) });
  const addFee = () => setDraft({ ...draft, fees: [...draft.fees, { nom: '', montant: '', applicableA: 'les_deux', obligatoire: true, ordre: draft.fees.length, actif: true }] });
  const addTranche = (planIndex) => setDraft({ ...draft, plans: draft.plans.map((plan, current) => current !== planIndex ? plan : { ...plan, tranches: [...plan.tranches, { nom: `Tranche ${plan.tranches.length + 1}`, montant: '', dateEcheance: '', ordre: plan.tranches.length + 1, actif: true }] }) });
  const trancheSum = (plan) => plan.tranches.reduce((sum, t) => sum + Number(t.montant || 0), 0);
    const levelOf = (label) => label.trim().split(/[-\s]/)[0];
  const divisionOf = (label) => label.trim().split(/[-\s]/).slice(1).join(' ');
  const applyToLevel = (planIndex) => {
    const source = draft.plans[planIndex];
    const level = levelOf(source.label);
    setDraft({ ...draft, plans: draft.plans.map((plan) => plan === source || levelOf(plan.label) !== level ? plan : { ...plan, montantTotal: source.montantTotal, tranches: source.tranches.map(({ id, ...rest }) => ({ ...rest })) }) });
  };

  const submit = (event) => { event.preventDefault(); saveFinancialConfiguration({ fees: draft.fees, plans: draft.plans }); setMode('view'); };

  if (!finance?.year) return <><Title title="Paramètres financiers" subtitle="Configurez les frais et tarifs de l'année active"/><Empty>Activez d'abord une année scolaire.</Empty></>;

    if (mode === 'view') {
    const planSignature = (plan) => JSON.stringify({ total: plan.montantTotal, tranches: plan.tranches.map((t) => ({ nom: t.nom, montant: t.montant, dateEcheance: t.dateEcheance })) });
    const configuredPlans = draft.plans.filter((p) => p.montantTotal);
    const searchedPlans = classSearch.trim() ? configuredPlans.filter((p) => p.label.toLowerCase().includes(classSearch.trim().toLowerCase())) : configuredPlans;
    const byLevel = new Map();
    for (const plan of searchedPlans) {
      const level = levelOf(plan.label);
      if (!byLevel.has(level)) byLevel.set(level, []);
      byLevel.get(level).push(plan);
    }
    const displayGroups = [];
    for (const [level, plans] of byLevel) {
      const bySignature = new Map();
      for (const plan of plans) {
        const sig = planSignature(plan);
        if (!bySignature.has(sig)) bySignature.set(sig, []);
        bySignature.get(sig).push(plan);
      }
      const totalAtLevel = configuredPlans.filter((p) => levelOf(p.label) === level).length;
      for (const [, group] of bySignature) {
        const label = bySignature.size === 1 && group.length === totalAtLevel
          ? level
          : `${level} ${group.map((p) => divisionOf(p.label)).sort().join('-')}`;
        displayGroups.push({ key: `${level}-${label}`, label, plan: group[0] });
      }
    }
    displayGroups.sort((a, b) => classRank(a.label) - classRank(b.label) || a.label.localeCompare(b.label, 'fr'));

    return (
      <>
        <Title title="Paramètres financiers" subtitle={`Année ${finance.year.libelle} · ${finance.site.nom}`}/>
        <Panel title="Frais généraux" action={<button type="button" onClick={() => setMode('edit')} className="flex items-center gap-1 text-sm font-semibold text-emerald-700"><Pencil className="h-3.5 w-3.5" />Modifier</button>}>
          {draft.fees.length ? (
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <div className="grid grid-cols-12 gap-3 bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-500">
                <span className="col-span-4">Libellé</span><span className="col-span-3">Montant</span><span className="col-span-3">Applicable à</span><span className="col-span-2">Obligatoire</span>
              </div>
              <div className="divide-y divide-slate-100">
                {draft.fees.map((fee, index) => (
                  <div key={fee.id || index} className="grid grid-cols-12 items-center gap-3 px-4 py-3 text-sm">
                    <span className="col-span-4 font-medium text-slate-800">{fee.nom}</span>
                    <span className="col-span-3">{money(fee.montant)}</span>
                    <span className="col-span-3 text-slate-500">{fee.applicableA === 'les_deux' ? 'Inscription et réinscription' : fee.applicableA === 'inscription' ? 'Inscription seulement' : 'Réinscription seulement'}</span>
                    <span className="col-span-2">{fee.obligatoire ? 'Oui' : 'Non'}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : <Empty>Aucun frais général configuré.</Empty>}
        </Panel>
        <Panel title="Tarifs par classe">
          <div className="relative mb-4">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2"/>
            <input type="text" value={classSearch} onChange={(e) => setClassSearch(e.target.value)} placeholder="Rechercher une classe (ex : 6e, 2nde A)" className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>
          {displayGroups.length ? (
            <div className="grid gap-4 lg:grid-cols-2">
              {displayGroups.map((group) => (
                <div key={group.key} className="rounded-xl border border-slate-200 p-4">
                  <h4 className="font-semibold text-slate-800">{group.label}</h4>
                  <p className="mt-1 text-sm text-slate-600">Tarif annuel : {money(group.plan.montantTotal)}</p>
                  <ul className="mt-3 space-y-1 text-xs text-slate-500">
                    {group.plan.tranches.map((t, i) => <li key={t.id || i}>{t.nom} — {money(t.montant)} · Échéance {t.dateEcheance}</li>)}
                  </ul>
                </div>
              ))}
            </div>
          ) : <Empty>{classSearch.trim() ? 'Aucune classe ne correspond à la recherche.' : 'Aucun tarif configuré.'}</Empty>}
        </Panel>
      </>
    );
  }

  return (
    <>
      <Title title="Paramètres financiers" subtitle={`Année ${finance.year.libelle} · ${finance.site.nom}`}/>
      <form onSubmit={submit}>
        <Panel title="Frais généraux" action={<button type="button" onClick={addFee} className="text-sm font-semibold text-emerald-700">+ Ajouter un frais</button>}>
          {draft.fees.length ? (
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <div className="grid grid-cols-12 gap-3 bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-500">
                <span className="col-span-4">Libellé</span><span className="col-span-3">Montant (F CFA)</span><span className="col-span-3">Applicable à</span><span className="col-span-2">Obligatoire</span>
              </div>
              <div className="divide-y divide-slate-100">
                {draft.fees.map((fee, index) => (
                  <div key={fee.id || index} className="grid grid-cols-12 items-center gap-3 px-4 py-3">
                    <input className="input col-span-4" value={fee.nom} onChange={(event) => setFee(index, 'nom', event.target.value)} required placeholder="Ex : Inscription"/>
                    <input className="input col-span-3" type="number" min="0" step="0.01" value={fee.montant} onChange={(event) => setFee(index, 'montant', event.target.value)} required/>
                    <select className="input col-span-3" value={fee.applicableA} onChange={(event) => setFee(index, 'applicableA', event.target.value)}>
                      <option value="les_deux">Inscription et réinscription</option><option value="inscription">Inscription seulement</option><option value="reinscription">Réinscription seulement</option>
                    </select>
                    <label className="col-span-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={fee.obligatoire} onChange={(event) => setFee(index, 'obligatoire', event.target.checked)}/> Oui</label>
                  </div>
                ))}
              </div>
            </div>
          ) : <Empty>Aucun frais général configuré.</Empty>}
        </Panel>

                  <Panel title="Tarifs par classe">
          <div className="relative mb-4">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2"/>
            <input type="text" value={classSearch} onChange={(e) => setClassSearch(e.target.value)} placeholder="Rechercher une classe (ex : 6e, 2nde A)" className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>
          {(() => {
            const filteredPlans = draft.plans
              .map((plan, planIndex) => ({ plan, planIndex }))
              .filter(({ plan }) => !classSearch.trim() || plan.label.toLowerCase().includes(classSearch.trim().toLowerCase()))
              .sort((a, b) => classRank(a.plan.label) - classRank(b.plan.label) || a.plan.label.localeCompare(b.plan.label, 'fr'));
            if (!filteredPlans.length) return <Empty>{classSearch.trim() ? 'Aucune classe ne correspond à la recherche.' : "Créez d'abord une classe annuelle."}</Empty>;
            return (
              <div className="grid gap-4 lg:grid-cols-2">
                {filteredPlans.map(({ plan, planIndex }) => {
                const sum = trancheSum(plan);
                const totalPlan = Number(plan.montantTotal || 0);
                const balanced = plan.tranches.length > 0 && sum === totalPlan;
                return (
                  <div key={plan.classeAnnuelleId} className="rounded-xl border border-slate-200 p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <h4 className="font-semibold text-slate-800">{plan.label}</h4>
                      {plan.tranches.length > 0 && <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${balanced ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>{balanced ? 'Tranches équilibrées' : `Écart ${money(totalPlan - sum)}`}</span>}
                      {draft.plans.filter((p) => p !== plan && levelOf(p.label) === levelOf(plan.label)).length > 0 && (
                        <button type="button" onClick={() => applyToLevel(planIndex)} disabled={!plan.montantTotal || !plan.tranches.length} className="shrink-0 text-xs font-semibold text-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed">Appliquer à tout le niveau</button>
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
            );
          })()}
        </Panel>

        <div className="flex gap-2">
          <button className="primary">Enregistrer la configuration</button>
          <button type="button" onClick={() => setMode('view')} className="rounded-lg bg-slate-100 px-4 py-2.5 text-sm text-slate-700">Annuler</button>
        </div>
      </form>
    </>
  );
}
function SecretaryHome({ secretaryClasses, setSection, loadClass }) {
  const classes = sortClasses(secretaryClasses);
  const totalStudents = classes.reduce((total, item) => total + Number(item.effectif || 0), 0);
  const emptyClasses = classes.filter((item) => Number(item.effectif || 0) === 0).length;

  const levels = [];
  const levelIndex = new Map();
  for (const item of classes) {
    const label = item.niveau_libelle || item.code_affichage;
    if (!levelIndex.has(label)) {
      levelIndex.set(label, levels.length);
      levels.push({ label, effectif: 0, ordre: item.ordre ?? 99 });
    }
    levels[levelIndex.get(label)].effectif += Number(item.effectif || 0);
  }
  levels.sort((a, b) => a.ordre - b.ordre);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-emerald-700">Registre scolaire</h2>
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
              <h3 className="font-semibold text-slate-900">Effectifs par niveau</h3>
              <p className="mt-1 text-xs text-slate-500">
                Sélectionnez « Gérer les classes » pour accéder aux groupes/séries en détail.
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

          {levels.length ? (
            <div className="divide-y divide-slate-100">
              {levels.map((level) => (
                <div
                  key={level.label}
                  className="flex w-full items-center justify-between gap-4 py-4"
                >
                  <p className="font-semibold text-slate-800">{level.label}</p>
                  <span className="shrink-0 rounded-lg bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-600">
                    {level.effectif} élève(s)
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-200 p-5">
              <p className="text-sm font-medium text-slate-700">Aucune classe annuelle.</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                Créez les classes après l'activation de l'année scolaire par le Directeur.
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
  const [studentQuery, setStudentQuery] = useState('');
  const [showResults, setShowResults] = useState(false);
  const [modePaiement, setModePaiement] = useState('especes');
  const [montantRemis, setMontantRemis] = useState('');
  const [referencePaiement, setReferencePaiement] = useState('');
  const [allocations, setAllocations] = useState({});

  const student = paymentOptions.find((item) => item.inscriptionId === studentId);
  const total = Object.values(allocations).reduce((sum, value) => sum + Number(value || 0), 0);
  const totalDu = (student?.obligations || []).reduce((sum, o) => sum + Number(o.reste || 0), 0);
  const solde = student && total > 0 && total >= totalDu;

  const matches = studentQuery.trim()
    ? paymentOptions.filter((item) => `${item.nom} ${item.prenom} ${item.matricule} ${item.classe}`.toLowerCase().includes(studentQuery.trim().toLowerCase())).slice(0, 8)
    : [];

  const selectStudent = (item) => {
    setStudentId(item.inscriptionId);
    setStudentQuery(`${item.nom} ${item.prenom} · ${item.classe}`);
    setShowResults(false);
    setAllocations({});
  };

  const distribute = (amount) => {
    let remaining = Number(amount) || 0;
    const next = {};
    (student?.obligations || []).filter((o) => o.reste > 0).forEach((o) => {
      if (remaining <= 0) return;
      const take = Math.min(remaining, o.reste);
      next[o.id] = String(take);
      remaining -= take;
    });
    setAllocations(next);
  };

  const setAllocation = (id, value) => setAllocations({ ...allocations, [id]: value });

  const submit = (event) => {
    event.preventDefault();
    createPayment({
      inscriptionId: studentId,
      modePaiement,
      montantRemis: modePaiement === 'especes' ? montantRemis : total,
      referencePaiement,
      allocations: Object.entries(allocations).filter(([, v]) => Number(v) > 0).map(([obligationId, montant]) => ({ obligationId, montant })),
    }, `${student.nom} ${student.prenom}`);
    setStudentId(''); setStudentQuery(''); setAllocations({}); setMontantRemis(''); setReferencePaiement('');
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-emerald-700">Caisse et inscriptions</h2>
        <p className="mt-1 text-sm text-slate-500">Enregistrez les inscriptions, encaissements et frais scolaires.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Card icon={<Banknote />} label="Encaissements de l'année en cours" value={money(cash?.today?.total)} />
        <Card icon={<Users />} label="Inscriptions actives" value={cash?.enrolledStudents || 0} />
        <Card icon={<CalendarDays />} label="Année active" value={cash?.activeYear?.libelle || 'Non configurée'} />
              {cash?.overdueInstallments?.count > 0 && (
        <button type="button" onClick={() => setSection('echeances')} className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-left transition hover:border-rose-300">
          <div className="text-rose-600 mb-3 w-5"><AlertTriangle /></div>
          <p className="text-xs text-rose-700">Échéances dépassées</p>
          <p className="font-semibold mt-1 text-slate-900">{cash.overdueInstallments.count} tranche(s) · {money(cash.overdueInstallments.totalReste)}</p>
        </button>
)}
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-5">
            <h3 className="font-semibold text-slate-900">Enregistrer un paiement</h3>
            <p className="mt-1 text-xs text-slate-500">Recherchez l'élève, sélectionnez les frais concernés et le moyen de paiement.</p>
          </div>

          <form onSubmit={submit} className="space-y-5">
            <div className="relative">
              <label className="block text-sm font-medium text-slate-700">Élève</label>
              <input
                type="text"
                value={studentQuery}
                onChange={(event) => { setStudentQuery(event.target.value); setShowResults(true); setStudentId(''); }}
                onFocus={() => setShowResults(true)}
                placeholder="Rechercher par nom, prénom, matricule ou classe"
                required
                className="input mt-1"
              />
              {showResults && matches.length > 0 && (
                <div className="absolute z-10 mt-1 w-full rounded-lg border border-slate-200 bg-white shadow-lg">
                  {matches.map((item) => (
                    <button type="button" key={item.inscriptionId} onClick={() => selectStudent(item)} className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-emerald-50">
                      <span className="font-medium text-slate-800">{item.nom} {item.prenom}</span>
                      <span className="text-xs text-slate-500">{item.matricule} · {item.classe}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

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
                        <p className="mt-1 text-xs text-slate-500">Reste : {money(obligation.reste)}{obligation.dateEcheance ? ` · Échéance ${obligation.dateEcheance}` : ''}</p>
                      </div>
                      <Input label="Montant soldé" type="number" min="0" max={obligation.reste} step="0.01" value={allocations[obligation.id] || ''} onChange={(event) => setAllocation(obligation.id, event.target.value)} />
                    </div>
                  ))}
                </div>

                <div className={`rounded-xl border p-4 ${solde ? 'border-emerald-100 bg-emerald-50/50' : 'border-amber-100 bg-amber-50/50'}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className={`text-xs font-semibold uppercase tracking-wide ${solde ? 'text-emerald-700' : 'text-amber-700'}`}>Total à enregistrer</p>
                      <p className="mt-1 text-xl font-semibold text-slate-900">{money(total)}</p>
                    </div>
                    <span className={`rounded-full px-3 py-1.5 text-xs font-semibold ${solde ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                      {solde ? 'Soldé' : `Reste ${money(totalDu - total)}`}
                    </span>
                  </div>
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
                    <Input label="Montant remis" type="number" min="0" step="0.01" value={montantRemis} onChange={(event) => { setMontantRemis(event.target.value); distribute(event.target.value); }} required />
                  ) : (
                    <Input label="Référence de paiement" value={referencePaiement} onChange={(event) => setReferencePaiement(event.target.value)} />
                  )}
                </div>

                <button className="w-full rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50" disabled={!total}>
                  Enregistrer le paiement
                </button>
              </>
            )}
          </form>
        </section>

        <aside className="space-y-5">
          <section className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">Opérations</p>
            <h3 className="mt-2 font-semibold text-slate-900">Gestion des inscriptions</h3>
            <p className="mt-2 text-xs leading-5 text-slate-500">Enregistrez une inscription, une réinscription ou importez un fichier Excel.</p>
            <button type="button" onClick={() => setSection('inscriptions')} className="mt-5 w-full rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700">Ouvrir les inscriptions</button>
          </section>
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="font-semibold text-slate-900">Configuration des frais</h3>
            <p className="mt-2 text-xs leading-5 text-slate-500">Définissez les frais généraux, tranches et échéances de l'année scolaire.</p>
            <button type="button" onClick={() => setSection('finances')} className="mt-5 text-sm font-semibold text-emerald-700">Gérer les frais</button>
          </section>
        </aside>
      </div>
    </div>
  );
}
function Enroll({ enrollOptions, enrollForm, setEnrollForm, createEnrollment, finance }) {
  const isNew = enrollForm.type === 'inscription';
  const set = (key) => (e) => setEnrollForm({ ...enrollForm, [key]: e.target.value });
  const [studentQuery, setStudentQuery] = useState('');
  const [showResults, setShowResults] = useState(false);
  const applicableFees = (finance?.fees || []).filter((fee) => fee.actif && (fee.applicable_a === enrollForm.type || fee.applicable_a === 'les_deux'));
  const toggleFee = (feeId) => { const current = enrollForm.paidFeeConfigIds || []; setEnrollForm({ ...enrollForm, paidFeeConfigIds: current.includes(feeId) ? current.filter((id) => id !== feeId) : [...current, feeId] }); };

  const matches = studentQuery.trim()
    ? (enrollOptions.students || []).filter((s) => `${s.nom} ${s.prenom} ${s.matricule}`.toLowerCase().includes(studentQuery.trim().toLowerCase())).slice(0, 8)
    : [];

  const selectStudent = (s) => {
    setEnrollForm({ ...enrollForm, studentId: s.id });
    setStudentQuery(`${s.nom} ${s.prenom} · ${s.matricule}`);
    setShowResults(false);
  };

  return <>
    <Title title="Inscriptions et réinscriptions" subtitle={enrollOptions?.year ? `Année ${enrollOptions.year.libelle}` : 'Aucune année active'}/>
    <Panel title="Enregistrer une inscription">
      {!enrollOptions?.year ? <Empty>Le directeur doit activer l'année scolaire.</Empty>
      : !enrollOptions.classes.length ? <Empty>La secrétaire doit créer les classes annuelles.</Empty>
      : <form onSubmit={createEnrollment} className="grid sm:grid-cols-2 gap-3">
          <label className="text-sm">Opération<select className="input" value={enrollForm.type} onChange={(e) => setEnrollForm({ ...enrollForm, type: e.target.value, paidFeeConfigIds: [], studentId: '' })}><option value="inscription">Nouvelle inscription</option><option value="reinscription">Réinscription</option></select></label>
          <label className="text-sm">Classe<select required className="input" value={enrollForm.annualClassId} onChange={set('annualClassId')}><option value="">Choisir</option>{enrollOptions.classes.map((c) => <option key={c.id} value={c.id}>{c.code_affichage}</option>)}</select></label>
          {isNew ? <>
            <Input label="Matricule national" value={enrollForm.matricule} onChange={set('matricule')} required/>
            <Input label="Nom" value={enrollForm.nom} onChange={set('nom')} required/>
            <Input label="Prénom" value={enrollForm.prenom} onChange={set('prenom')} required/>
            <Input label="Date de naissance" type="date" value={enrollForm.date_naissance} onChange={set('date_naissance')}/>
            <Input label="Lieu de naissance" value={enrollForm.lieu_naissance} onChange={set('lieu_naissance')}/>
            <Input label="Nationalité" value={enrollForm.nationalite} onChange={set('nationalite')}/>
            <Input label="Téléphone parent/tuteur" value={enrollForm.telephone} onChange={set('telephone')}/>
            <label className="text-sm">Sexe<select className="input" value={enrollForm.sexe} onChange={set('sexe')}><option value="">Non renseigné</option><option value="M">Masculin</option><option value="F">Féminin</option></select></label>
          </> : <div className="relative sm:col-span-2">
            <label className="block text-sm">Élève à réinscrire
              <input
                type="text"
                value={studentQuery}
                onChange={(e) => { setStudentQuery(e.target.value); setShowResults(true); setEnrollForm({ ...enrollForm, studentId: '' }); }}
                onFocus={() => setShowResults(true)}
                placeholder="Rechercher par nom, prénom ou matricule"
                required={!enrollForm.studentId}
                className="input mt-1"
              />
            </label>
            {showResults && matches.length > 0 && (
              <div className="absolute z-10 mt-1 w-full rounded-lg border border-slate-200 bg-white shadow-lg">
                {matches.map((s) => (
                  <button type="button" key={s.id} onClick={() => selectStudent(s)} className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-emerald-50">
                    <span className="font-medium text-slate-800">{s.nom} {s.prenom}</span>
                    <span className="text-xs text-slate-500">{s.matricule}</span>
                  </button>
                ))}
              </div>
            )}
            {studentQuery.trim() && !matches.length && !enrollForm.studentId && (
              <p className="mt-1 text-xs text-rose-600">Aucun élève ne correspond à cette recherche.</p>
            )}
          </div>}
          {applicableFees.length > 0 && <div className="sm:col-span-2">
            <p className="mb-2 text-sm font-medium text-slate-700">Frais généraux à solder maintenant (espèces)</p>
            <div className="space-y-2 rounded-lg border border-slate-200 p-3">
              {applicableFees.map((fee) => <label key={fee.id} className="flex items-center justify-between gap-3 text-sm">
                <span className="flex items-center gap-2"><input type="checkbox" checked={(enrollForm.paidFeeConfigIds || []).includes(fee.id)} onChange={() => toggleFee(fee.id)} />{fee.nom}{!fee.obligatoire ? ' (facultatif)' : ''}</span>
                <span className="text-slate-500">{money(fee.montant)}</span>
              </label>)}
            </div>
            <p className="mt-1 text-xs text-slate-500">Les frais non cochés resteront à régler en caisse.</p>
          </div>}
          <button className="sm:col-span-2 primary" disabled={!isNew && !enrollForm.studentId}>Valider l'opération</button>
        </form>}
    </Panel>
  </>;
}
function Monitoring({ monitoring, setSection }) {
  const totals = monitoring?.totals || {};
  const activeYear = monitoring?.activeYear?.libelle || 'Non configurée';

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-violet-700">Suivi pédagogique</h2>
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

