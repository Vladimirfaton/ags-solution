import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, CreditCard, Download, FileDown, FileText, Image as ImageIcon, Loader2, Pencil, Plus, Printer, Search, Settings2, Upload, Users } from 'lucide-react';
import QRCode from 'qrcode';
import { cartesAPI } from '../services/api';
import ObservationsPanel from '../components/ObservationsPanel';
import { Empty, NotifyMenu, StatCard, TextInput, formatDateFr, photoUrl, signatureUrl } from '../components/CardAdminShared';
import {
  DEFAULT_CARD_MM, buildQrPayload, fitTitleSize, generateBrouillonPDF, generateCardImages,
  generateFinalCardsPDF, generateSingleCardPDF, getSchoolYear, printFinalCards, wrapText,
} from '../utils/pdfUtils';

const PREVIEW_W = 342;
const BASE_PT = 242.6;
const SCALE = PREVIEW_W / BASE_PT;
const u = (n) => n * SCALE;
const PREVIEW_H = PREVIEW_W * (53.98 / 85.6);

let measureCanvas = null;
const measureTextPx = (text, sizePx, weight = 'bold') => {
  if (!measureCanvas) measureCanvas = document.createElement('canvas');
  const context = measureCanvas.getContext('2d');
  context.font = `${weight} ${sizePx}px Arial, Helvetica, sans-serif`;
  return context.measureText(text || '').width;
};
const previewMeasurer = { widthOfTextAtSize: (text, size) => measureTextPx(text, size, 'bold') };

const formatSexe = (value) => {
  const sexe = (value || '').toString().trim().toUpperCase();
  if (sexe === 'F' || sexe.startsWith('FEM')) return 'Féminin';
  if (sexe === 'M' || sexe.startsWith('MAS')) return 'Masculin';
  return value || '';
};

function Tricolor({ left, top, width, height }) {
  const segment = width / 3;
  return (
    <div style={{ position: 'absolute', left, top, width, height, display: 'flex' }}>
      <div style={{ width: segment, background: '#00873E' }} />
      <div style={{ width: segment, background: '#FCD900' }} />
      <div style={{ width: segment, background: '#E31C24' }} />
    </div>
  );
}

function RectoPreview({ student, cls, college, year }) {
  const logoW = u(130);
  const logoH = logoW * 0.214;
  const P = u(5);
  const labelSize = u(8);
  const lineH = u(12);

  const rows = [
    ['Nom :', student?.nom || ''],
    ['Prénom(s) :', student?.prenom || ''],
    ['Né(e) le :', `${formatDateFr(student?.date_naissance)}${student?.lieu_naissance ? `   à   ${student.lieu_naissance}` : ''}`],
    ['Sexe :', formatSexe(student?.sexe)],
    ['Nationalité :', student?.nationalite || ''],
    ['Adresse :', student?.adresse || ''],
    ['Classe :', cls?.code || ''],
  ];

  const headerBoxW = PREVIEW_W - (P + logoW + u(4)) - u(5);
  const nomText = (college?.nom || '').toUpperCase();
  const hasSlogan = !!college?.slogan;
  const adresseLigne = [college?.adresse_postale, college?.commune].filter(Boolean).join('   ');
  const hasAddr = !!(college?.adresse_postale || college?.commune);

  const NAME_MAX = u(7);
  const NAME_MIN = u(5);
  const SMALL_MAX = u(5.5);
  const SMALL_MIN = u(4);

  let totalRows = 1 + (hasSlogan ? 1 : 0) + (hasAddr ? 1 : 0);
  let rowH = logoH / totalRows;
  let nameSize = Math.max(Math.min(NAME_MAX, rowH / 1.15), NAME_MIN);
  let nameLines;
  if (previewMeasurer.widthOfTextAtSize(nomText, nameSize) <= headerBoxW) {
    nameLines = [nomText];
  } else {
    totalRows = 2 + (hasSlogan ? 1 : 0) + (hasAddr ? 1 : 0);
    rowH = logoH / totalRows;
    nameSize = Math.max(Math.min(NAME_MAX, rowH / 1.15), NAME_MIN);
    nameLines = wrapText(previewMeasurer, nomText, nameSize, headerBoxW, 2);
  }
  const sloganSize = hasSlogan ? Math.max(Math.min(SMALL_MAX, rowH / 1.15), SMALL_MIN) : 0;
  const addrSize = hasAddr ? Math.max(Math.min(SMALL_MAX, rowH / 1.15), SMALL_MIN) : 0;

  let topCursor = P;
  const nameBlocks = nameLines.map((line) => {
    const top = topCursor;
    topCursor += nameSize * 1.15;
    return { line, top };
  });
  const sloganTop = hasSlogan ? topCursor : null;
  if (hasSlogan) topCursor += sloganSize * 1.15;
  const adresseTop = hasAddr ? topCursor : null;

  const titleTop = P + logoH + u(11);
  const titleBlockH = u(10) * 1.25;
  const rowsTop = titleTop + titleBlockH + u(2);
  const photoTop = rowsTop;
  const photoH = rows.length * lineH;
  const photoW = photoH * (35 / 45);
  const sigW = u(54);
  const sigH = u(19);

  return (
    <div style={{ position: 'relative', width: PREVIEW_W, height: PREVIEW_H, background: '#fff', border: '1px solid #cbd5e1', overflow: 'hidden', fontFamily: 'Arial, Helvetica, sans-serif', color: '#000' }}>
      <img src="/logo.png" alt="" style={{ position: 'absolute', left: P, top: P, width: logoW }} />

      <div style={{ position: 'absolute', left: P + logoW + u(4), width: headerBoxW, textAlign: 'center' }}>
        {nameBlocks.map(({ line, top }, index) => (
          <div key={index} style={{ position: 'absolute', left: 0, width: '100%', top, fontSize: nameSize, fontWeight: 700 }}>{line}</div>
        ))}
        {sloganTop !== null && (
          <div style={{ position: 'absolute', left: 0, width: '100%', top: sloganTop, fontSize: sloganSize, fontStyle: 'italic' }}>{college.slogan}</div>
        )}
        {adresseTop !== null && (
          college?.adresse_postale ? (
            <div style={{ position: 'absolute', left: 0, width: '100%', top: adresseTop, fontSize: addrSize }}><span style={{ marginRight: u(2) }}>✉</span>{adresseLigne}</div>
          ) : (
            <div style={{ position: 'absolute', left: 0, width: '100%', top: adresseTop, fontSize: addrSize }}>{college.commune}</div>
          )
        )}
      </div>

      <div style={{ position: 'absolute', left: 0, top: titleTop, width: PREVIEW_W, textAlign: 'center', fontSize: u(10), fontWeight: 700, letterSpacing: 0.2 }}>
        CARTE D'IDENTITE SCOLAIRE&nbsp;&nbsp;&nbsp;{year}
      </div>

      <div style={{ position: 'absolute', left: u(8), top: photoTop, width: photoW, height: photoH, background: '#141414', overflow: 'hidden' }}>
        {student?.photo_path && <img src={photoUrl(student.photo_path)} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />}
      </div>
      <div style={{ position: 'absolute', left: u(8), top: photoTop + photoH + u(2), width: photoW, textAlign: 'center', fontSize: u(7), fontWeight: 700 }}>
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
      <div style={{ position: 'absolute', right: u(5), top: PREVIEW_H - u(15) - sigH, width: sigW, height: sigH, border: '1px solid #333' }} />
      <div style={{ position: 'absolute', right: u(5), top: PREVIEW_H - u(13), width: sigW, textAlign: 'center', fontSize: u(4.2), fontStyle: 'italic', color: '#737373' }}>
        Signature de l'apprenant
      </div>
    </div>
  );
}

function VersoPreview({ college, year, qrDataUrl }) {
  const nameText = (college?.nom || '').toUpperCase();
  const P = u(6);
  const nameMaxWidth = PREVIEW_W - P * 2;
  const fit = fitTitleSize((text, size) => measureTextPx(text, size, 'bold'), nameText, PREVIEW_W * 0.7, nameMaxWidth, u(8), u(15));
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
    <div style={{ position: 'relative', width: PREVIEW_W, height: PREVIEW_H, background: '#fff', border: '1px solid #cbd5e1', overflow: 'hidden', fontFamily: 'Arial, Helvetica, sans-serif', color: '#000' }}>
      <div style={{ position: 'absolute', left: 0, top: u(6), width: PREVIEW_W, textAlign: 'center' }}>
        {nameLines.map((line, index) => <div key={index} style={{ fontSize: fit.size, fontWeight: 700, lineHeight: 1.2 }}>{line}</div>)}
        {college?.telephone && <div style={{ fontSize: u(6.5), marginTop: u(4) }}>TEL : {college.telephone}</div>}
        <div style={{ fontSize: u(6.5), fontWeight: 700, marginTop: u(4) }}>CARTE D'IDENTITE SCOLAIRE : {year}</div>
      </div>

      <div style={{ position: 'absolute', left: rightX, top: labelTop, width: rightW, textAlign: 'center', fontSize: u(6), fontWeight: 700 }}>LE DIRECTEUR</div>

      <div style={{ position: 'absolute', left: sigX, top: sigAreaTop, width: sigBoxW, height: sigBoxH, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {college?.signature_path && <img src={signatureUrl(college.signature_path)} alt="" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />}
      </div>

      {(college?.directeur_prenom || college?.directeur_nom) && (
        <div style={{ position: 'absolute', left: rightX, top: nameTop, width: rightW, textAlign: 'center', fontSize: u(6.5), fontWeight: 700 }}>
          <span style={{ borderBottom: '1px solid #000', paddingBottom: u(1) }}>{`${college?.directeur_prenom || ''} ${college?.directeur_nom || ''}`.trim()}</span>
        </div>
      )}

      <Tricolor left={(PREVIEW_W - bandW) / 2} top={bandTop} width={bandW} height={u(4.5)} />

      <div style={{ position: 'absolute', left: u(14), top: (PREVIEW_H - qrSize) / 2 + u(6), width: qrSize, height: qrSize, border: qrDataUrl ? 'none' : '1px solid #000' }}>
        {qrDataUrl && <img src={qrDataUrl} alt="QR" style={{ width: '100%', height: '100%' }} />}
      </div>
    </div>
  );
}

function StudentEditModal({ student, onClose, onSaved, onError }) {
  const [form, setForm] = useState({
    nom: student.nom || '',
    prenom: student.prenom || '',
    sexe: student.sexe || '',
    dateNaissance: String(student.date_naissance || '').slice(0, 10),
    lieuNaissance: student.lieu_naissance || '',
    nationalite: student.nationalite || '',
    telephone: student.telephone || '',
  });
  const [saving, setSaving] = useState(false);
  const set = (key) => (value) => setForm((current) => ({ ...current, [key]: value }));

  const save = async () => {
    setSaving(true);
    try {
      await cartesAPI.updateStudent(student.id, form);
      await onSaved();
      onClose();
    } catch (err) {
      onError(err.response?.data?.error || 'Enregistrement impossible.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-xl bg-white p-6">
        <h3 className="mb-1 text-sm font-semibold text-slate-800">Modifier l'élève</h3>
        <p className="mb-4 text-xs text-slate-500">Matricule {student.matricule}</p>
        <div className="mb-5 grid grid-cols-2 gap-3">
          <TextInput label="Nom" value={form.nom} onChange={set('nom')} />
          <TextInput label="Prénom" value={form.prenom} onChange={set('prenom')} />
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-600">Sexe</label>
            <select value={form.sexe} onChange={(event) => set('sexe')(event.target.value)} className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
              <option value="">Non renseigné</option><option value="M">M</option><option value="F">F</option>
            </select>
          </div>
          <TextInput label="Date de naissance" type="date" value={form.dateNaissance} onChange={set('dateNaissance')} />
          <TextInput label="Lieu de naissance" value={form.lieuNaissance} onChange={set('lieuNaissance')} />
          <TextInput label="Nationalité" value={form.nationalite} onChange={set('nationalite')} />
          <div className="col-span-2"><TextInput label="Contact parent" value={form.telephone} onChange={set('telephone')} /></div>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={save} disabled={saving} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:bg-slate-300">{saving ? 'Enregistrement...' : 'Enregistrer'}</button>
          <button type="button" onClick={onClose} className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200">Annuler</button>
        </div>
      </div>
    </div>
  );
}

const matchStudent = (student, term) => [student.matricule, student.nom, student.prenom].some((value) => (value || '').toLowerCase().includes(term));

function StudentsTab({ students, onEdit, onReload, onNotice, onError }) {
  const [sub, setSub] = useState('list');
  const [search, setSearch] = useState('');
  const [files, setFiles] = useState([]);
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const input = useRef(null);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return term ? students.filter((student) => matchStudent(student, term)) : students;
  }, [students, search]);

  const uploadPhotos = async () => {
    if (!files.length) return;
    setBusy(true);
    let done = 0;
    const orphans = [];
    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      const matricule = file.name.replace(/\.[^.]+$/, '').trim().toUpperCase();
      const student = students.find((item) => (item.matricule || '').toUpperCase() === matricule);
      if (!student) orphans.push(file.name);
      else {
        try { await cartesAPI.uploadStudentPhoto(student.id, file); done += 1; } catch { orphans.push(file.name); }
      }
      setProgress(Math.round(((index + 1) / files.length) * 100));
    }
    if (done) onNotice(`${done} photo(s) associée(s).`);
    if (orphans.length) onError(`Sans correspondance : ${orphans.join(', ')}`);
    setFiles([]);
    setProgress(0);
    setBusy(false);
    if (input.current) input.current.value = '';
    await onReload();
  };

  const subTabs = [{ key: 'list', label: 'Liste', icon: Search }, { key: 'photos', label: 'Photos', icon: ImageIcon }];

  return (
    <div>
      <div className="mb-5 flex gap-1 border-b border-slate-200">
        {subTabs.map(({ key, label, icon: Icon }) => (
          <button key={key} type="button" onClick={() => setSub(key)} className={`flex items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium transition ${sub === key ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
            <Icon className="h-3.5 w-3.5" />{label}
          </button>
        ))}
      </div>

      {sub === 'list' && (
        <>
          <div className="mb-4 flex items-center gap-3">
            <div className="relative mr-auto">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input type="text" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Matricule, nom, prénom" className="w-64 rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
            <span className="text-xs text-slate-400">{visible.length} / {students.length} élève(s)</span>
          </div>
          {!visible.length ? <Empty>{search ? 'Aucun résultat.' : 'Aucun élève dans cette classe.'}</Empty> : (
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
              <table className="w-full text-sm">
                <thead className="border-b border-slate-200 bg-slate-50">
                  <tr className="text-left text-xs font-medium text-slate-500">
                    <th className="px-4 py-3">Matricule</th><th className="px-4 py-3">Nom</th><th className="px-4 py-3">Prénom(s)</th><th className="px-4 py-3">Sexe</th>
                    <th className="px-4 py-3">Date et lieu de naissance</th><th className="px-4 py-3">Contact parent</th><th className="px-4 py-3">Photo</th><th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((student) => (
                    <tr key={student.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60">
                      <td className="px-4 py-3 font-medium text-slate-800">{student.matricule}</td>
                      <td className="px-4 py-3 text-slate-700">{student.nom}</td>
                      <td className="px-4 py-3 text-slate-700">{student.prenom}</td>
                      <td className="px-4 py-3 text-slate-600">{student.sexe}</td>
                      <td className="px-4 py-3 text-slate-600">{formatDateFr(student.date_naissance) || '—'}{student.lieu_naissance ? ` · ${student.lieu_naissance}` : ''}</td>
                      <td className="px-4 py-3 text-slate-600">{student.telephone || '—'}</td>
                      <td className="px-4 py-3"><span className={`rounded px-2 py-0.5 text-xs font-medium ${student.photo_path ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{student.photo_path ? 'OK' : 'Manquante'}</span></td>
                      <td className="px-4 py-3"><div className="flex justify-end"><button type="button" onClick={() => onEdit(student)} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" title="Modifier"><Pencil className="h-3.5 w-3.5" /></button></div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {sub === 'photos' && (
        <div className="max-w-3xl space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <p className="mb-1 text-sm font-medium text-slate-700">Nommer les fichiers</p>
            <p className="mb-4 text-xs text-slate-500">Chaque photo doit porter le matricule de l'élève comme nom de fichier : MAT001.jpg, MAT002.jpg. L'association est automatique. Sélectionnez le dossier entier d'un coup.</p>
            <input ref={input} type="file" multiple accept="image/png,image/jpeg" onChange={(event) => setFiles(Array.from(event.target.files))} className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-4 file:py-2 file:text-sm file:font-medium file:text-slate-700" />
          </div>
          {files.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <p className="mb-3 text-sm font-medium text-slate-700">{files.length} fichier(s) sélectionné(s)</p>
              {progress > 0 && (
                <div className="mb-4">
                  <div className="h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-emerald-500 transition-all" style={{ width: `${progress}%` }} /></div>
                  <p className="mt-1 text-xs text-slate-500">{progress}%</p>
                </div>
              )}
              <button type="button" onClick={uploadPhotos} disabled={busy} className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:bg-slate-300">
                <Upload className="h-4 w-4" />{busy ? 'Envoi en cours...' : 'Associer les photos'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DraftTab({ data, students, classId, onEdit, onReload, onNotice, onError }) {
  const [generating, setGenerating] = useState(false);

  const exportPdf = async () => {
    setGenerating(true);
    try { await generateBrouillonPDF(students, data.classInfo, data.etablissement); onNotice('PDF généré et téléchargé.'); }
    catch { onError('Erreur lors de la génération du PDF.'); }
    finally { setGenerating(false); }
  };

  const changePhoto = async (studentId, file) => {
    if (!file) return;
    try { await cartesAPI.uploadStudentPhoto(studentId, file); await onReload(); onNotice('Photo mise à jour.'); }
    catch (err) { onError(err.response?.data?.error || 'Mise à jour de la photo impossible.'); }
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-slate-500">{students.length} élève{students.length > 1 ? 's' : ''}</p>
        <button type="button" onClick={exportPdf} disabled={generating || !students.length} className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:bg-slate-300">
          {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}{generating ? 'Génération...' : 'Exporter PDF (A4 paysage)'}
        </button>
      </div>
      <div className="flex gap-6">
        <div className="flex-1">
          {!students.length ? <Empty>Aucun élève dans cette classe.</Empty> : (
            <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
              {students.map((student) => (
                <div key={student.id} className="flex items-center gap-4 p-4">
                  <label className="group relative flex h-14 w-14 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-lg bg-slate-100">
                    {student.photo_path ? <img src={photoUrl(student.photo_path)} alt={student.nom} className="h-full w-full object-cover" /> : <ImageIcon className="h-5 w-5 text-slate-300" />}
                    <input type="file" accept="image/png,image/jpeg" onChange={(event) => changePhoto(student.id, event.target.files[0])} className="hidden" />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition group-hover:bg-black/40"><span className="text-[10px] text-white opacity-0 group-hover:opacity-100">Changer</span></div>
                  </label>
                  <div className="grid flex-1 grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-4">
                    <div><span className="text-xs text-slate-400">Matricule</span><div className="font-medium text-slate-800">{student.matricule}</div></div>
                    <div><span className="text-xs text-slate-400">Nom</span><div className="text-slate-700">{student.nom}</div></div>
                    <div><span className="text-xs text-slate-400">Prénom</span><div className="text-slate-700">{student.prenom}</div></div>
                    <div><span className="text-xs text-slate-400">Sexe</span><div className="text-slate-700">{student.sexe}</div></div>
                    <div><span className="text-xs text-slate-400">Date et lieu de naissance</span><div className="text-slate-700">{formatDateFr(student.date_naissance) || '—'} {student.lieu_naissance ? `· ${student.lieu_naissance}` : ''}</div></div>
                    <div><span className="text-xs text-slate-400">Nationalité</span><div className="text-slate-700">{student.nationalite || '—'}</div></div>
                    <div className="col-span-2"><span className="text-xs text-slate-400">Contact parent</span><div className="text-slate-700">{student.telephone || '—'}</div></div>
                  </div>
                  <button type="button" onClick={() => onEdit(student)} className="shrink-0 rounded-md p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700" title="Modifier"><Pencil className="h-4 w-4" /></button>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="hidden w-80 lg:block"><ObservationsPanel classId={classId} isAdmin /></div>
      </div>
    </div>
  );
}

function CardsTab({ data, students, onNotice, onError }) {
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
  const college = data.etablissement;
  const cls = data.classInfo;

  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(buildQrPayload(college), { margin: 0, width: 300 })
      .then((url) => { if (alive) setQrDataUrl(url); })
      .catch(() => { if (alive) setQrDataUrl(null); });
    return () => { alive = false; };
  }, [college?.id]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return term ? students.filter((student) => matchStudent(student, term)) : students;
  }, [students, search]);

  const target = selected.length ? students.filter((student) => selected.includes(student.id)) : students;
  const withPhoto = students.filter((student) => student.photo_path).length;
  const pages = Math.ceil(target.length / 8) || 0;
  const options = {
    cardWidthMm: Number(cardW) || DEFAULT_CARD_MM.width,
    cardHeightMm: Number(cardH) || DEFAULT_CARD_MM.height,
    includeVerso,
    cropMarks,
  };

  const run = async (key, work, success) => {
    setBusy(key);
    try { await work(); if (success) onNotice(success); }
    catch (error) { console.error(error); onError('Erreur lors de l’opération. Vérifiez que /logo.png existe dans le dossier public.'); }
    finally { setBusy(''); }
  };

  const toggle = (id) => setSelected((current) => (current.includes(id) ? current.filter((value) => value !== id) : [...current, id]));

  return (
    <div>
      <div className="mb-5 rounded-xl border border-slate-200 bg-white p-5">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="mr-auto text-sm text-slate-700">
            <span className="font-medium">{target.length}</span> carte{target.length > 1 ? 's' : ''} à produire
            {selected.length > 0 && <span className="text-emerald-700"> (sélection)</span>}
            <span className="text-slate-400"> · {pages} page{pages > 1 ? 's' : ''} A4 · année {year}</span>
          </div>
          <button type="button" onClick={() => setShowSettings((value) => !value)} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:border-slate-300"><Settings2 className="h-4 w-4" />Format</button>
        </div>

        {showSettings && (
          <div className="mb-5 grid grid-cols-1 gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4 sm:grid-cols-4">
            <TextInput label="Largeur carte (mm)" type="number" value={cardW} onChange={setCardW} />
            <TextInput label="Hauteur carte (mm)" type="number" value={cardH} onChange={setCardH} />
            <div className="flex flex-col justify-end gap-2 text-sm text-slate-700">
              <label className="flex items-center gap-2"><input type="checkbox" checked={includeVerso} onChange={(event) => setIncludeVerso(event.target.checked)} />Inclure le verso</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={cropMarks} onChange={(event) => setCropMarks(event.target.checked)} />Repères de découpe</label>
            </div>
            <div className="flex items-end"><button type="button" onClick={() => { setCardW(DEFAULT_CARD_MM.width); setCardH(DEFAULT_CARD_MM.height); }} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700">Réinitialiser (ISO ID-1)</button></div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <button type="button" onClick={() => run('a4', () => generateFinalCardsPDF(target, cls, college, { ...options, layout: 'a4' }), 'PDF A4 généré.')} disabled={!!busy || !target.length} className="flex items-center justify-center gap-2 rounded-lg bg-emerald-600 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:bg-slate-300">
            {busy === 'a4' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}Exporter PDF — 8 cartes / page
          </button>
          <button type="button" onClick={() => run('pvc', () => generateFinalCardsPDF(target, cls, college, { ...options, layout: 'pvc' }), 'PDF format carte généré.')} disabled={!!busy || !target.length} className="flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white py-2.5 text-sm font-medium text-slate-700 hover:border-slate-300 disabled:opacity-50">
            {busy === 'pvc' ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}Exporter PDF — 1 carte / page
          </button>
          <button type="button" onClick={() => run('print', () => printFinalCards(target, cls, college, { ...options, layout: 'pvc' }))} disabled={!!busy || !target.length} className="flex items-center justify-center gap-2 rounded-lg bg-slate-800 py-2.5 text-sm font-medium text-white hover:bg-slate-900 disabled:bg-slate-300">
            {busy === 'print' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}Imprimer (PVC)
          </button>
        </div>
        <p className="mt-3 text-xs text-slate-400">L'impression ouvre la boîte de dialogue du système : choisissez l'imprimante PVC, le format ({options.cardWidthMm} × {options.cardHeightMm} mm) et le recto/verso. Le format PVC est réservé à une imprimante de cartes dédiée.</p>
      </div>

      <div className="mb-5 grid grid-cols-3 gap-3">
        {[['Élèves', students.length, 'text-slate-800'], ['Avec photo', withPhoto, 'text-emerald-600'], ['Sans photo', students.length - withPhoto, 'text-rose-500']].map(([label, value, color]) => (
          <div key={label} className="rounded-xl border border-slate-200 bg-white p-4 text-center"><div className={`text-xl font-semibold ${color}`}>{value}</div><div className="mt-1 text-xs text-slate-500">{label}</div></div>
        ))}
      </div>

      <div className="mb-5 rounded-xl border border-slate-200 bg-white p-5">
        <p className="text-sm font-medium text-slate-800">Verso commun</p>
        <p className="mb-4 text-xs text-slate-500">Identique sur toutes les cartes de cet établissement.</p>
        <div className="overflow-x-auto"><VersoPreview college={college} year={year} qrDataUrl={qrDataUrl} /></div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <p className="mr-auto text-sm font-medium text-slate-800">Aperçu des rectos</p>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input type="text" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Matricule, nom, prénom" className="w-56 rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
        </div>
        {selected.length > 0 && <button type="button" onClick={() => setSelected([])} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700">Annuler la sélection ({selected.length})</button>}
      </div>

      {!visible.length ? <Empty>Aucun élève à afficher.</Empty> : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 xl:grid-cols-3">
          {visible.map((student) => {
            const on = selected.includes(student.id);
            return (
              <div key={student.id} className={`rounded-xl border bg-white p-3 transition ${on ? 'border-emerald-400' : 'border-slate-200'}`}>
                <div className="overflow-x-auto"><RectoPreview student={student} cls={cls} college={college} year={year} /></div>
                <div className="mt-3 flex items-center gap-2">
                  <label className="mr-auto flex cursor-pointer items-center gap-2 text-xs text-slate-600"><input type="checkbox" checked={on} onChange={() => toggle(student.id)} />Sélectionner</label>
                  <button type="button" onClick={() => run(`one-${student.id}`, () => generateSingleCardPDF(student, cls, college, options))} disabled={!!busy} className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:border-slate-300 disabled:opacity-50" title="Exporter cette carte en PDF"><FileDown className="h-3.5 w-3.5" />PDF</button>
                  <button type="button" onClick={() => run(`png-${student.id}`, () => generateCardImages([student], cls, college, options))} disabled={!!busy} className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:border-slate-300 disabled:opacity-50" title="Exporter cette carte en PNG 300 DPI"><ImageIcon className="h-3.5 w-3.5" />PNG</button>
                  <button type="button" onClick={() => run(`print-${student.id}`, () => printFinalCards([student], cls, college, { ...options, layout: 'pvc' }))} disabled={!!busy} className="flex items-center gap-1.5 rounded-md bg-slate-800 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-slate-900 disabled:opacity-50" title="Imprimer cette carte"><Printer className="h-3.5 w-3.5" /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const TABS = [
  { key: 'eleves', label: 'Élèves', icon: Users },
  { key: 'brouillon', label: 'Brouillon', icon: FileText },
  { key: 'cartes', label: 'Cartes finales', icon: CreditCard },
];

export default function CardClassPanel({ item, onNotice, onError }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('eleves');
  const [editing, setEditing] = useState(null);

  const load = async () => {
    try { setData((await cartesAPI.adminPreview(item.id)).data); }
    catch (err) { onError(err.response?.data?.error || 'Impossible de charger la classe.'); }
  };

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [item.id]);

  const students = data?.students || [];

  return (
    <div>
      {editing && <StudentEditModal student={editing} onClose={() => setEditing(null)} onSaved={async () => { await load(); onNotice('Élève mis à jour.'); }} onError={onError} />}

      <div className="mb-5 flex flex-wrap items-center gap-3 border-b border-slate-200 pb-3">
        <div className="mr-auto flex gap-1">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button key={key} type="button" onClick={() => setTab(key)} className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${tab === key ? 'bg-emerald-50 text-emerald-700' : 'text-slate-500 hover:bg-slate-100'}`}>
              <Icon className="h-4 w-4" />{label}{key === 'eleves' && <span className="text-xs text-slate-400">({students.length})</span>}
            </button>
          ))}
        </div>
        <NotifyMenu classId={item.id} onNotice={onNotice} onError={onError} />
      </div>

      {loading && <div className="flex items-center justify-center py-16 text-slate-400"><Loader2 className="mr-2 h-5 w-5 animate-spin" /><span className="text-sm">Chargement</span></div>}
      {data && tab === 'eleves' && <StudentsTab students={students} onEdit={setEditing} onReload={load} onNotice={onNotice} onError={onError} />}
      {data && tab === 'brouillon' && <DraftTab data={data} students={students} classId={item.id} onEdit={setEditing} onReload={load} onNotice={onNotice} onError={onError} />}
      {data && tab === 'cartes' && <CardsTab data={data} students={students} onNotice={onNotice} onError={onError} />}
    </div>
  );
}