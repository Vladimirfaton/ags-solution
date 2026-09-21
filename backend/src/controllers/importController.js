import ExcelJS from 'exceljs';
import { Student } from '../models/Student.js';
import { Class } from '../models/Class.js';
import logger from '../config/logger.js';

const normalizeHeader = (value) => {
  if (value == null) return '';
  return String(value)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

const toISODate = (value) => {
  if (!value && value !== 0) return null;

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const d = String(value.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    const base = new Date(Date.UTC(1899, 11, 30));
    const d = new Date(base.getTime() + value * 86400000);
    if (!Number.isNaN(d.getTime())) {
      const y = d.getUTCFullYear();
      const m = String(d.getUTCMonth() + 1).padStart(2, '0');
      const day = String(d.getUTCDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    }
  }

  const str = String(value).trim();
  if (!str || str === 'null' || str === 'undefined') return null;

  const iso = str.match(/^\d{4}-\d{2}-\d{2}$/);
  if (iso) return str;

  const fr = str.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (fr) {
    const [, d, m, y] = fr;
    const day = Number(d);
    const month = Number(m);
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    return `${y}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  const parsed = new Date(str);
  if (!Number.isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, '0');
    const d = String(parsed.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  return null;
};

const cell = (v) => (v == null ? '' : String(v).trim());

const findKeyIndex = (headers, candidates) => {
  for (const candidate of candidates) {
    const idx = headers.findIndex((header) => header && header.includes(candidate));
    if (idx >= 0) return idx;
  }
  return -1;
};

const parseExcelRow = (row, headers) => {
  if (!row || !Array.isArray(row.values)) return null;

  const values = row.values.slice(1);
  if (!values.some((value) => value !== null && value !== undefined && String(value).trim() !== '')) {
    return null;
  }

  const headerList = Array.isArray(headers) ? headers.map(normalizeHeader) : [];
  const getValue = (candidateList) => {
    const index = findKeyIndex(headerList, candidateList);
    if (index < 0) return '';
    return cell(values[index]);
  };

  const matricule = getValue(['matricule']);
  const nom = getValue(['nom']);
  const prenom = getValue(['prenom', 'prénom', 'prenoms', 'prenom s']);
  const sexe = getValue(['sexe']).toUpperCase();
  const dateNaissance = toISODate(values[findKeyIndex(headerList, ['date de naissance', 'date naissance', 'ne le'])] ?? '');
  const lieu = getValue(['lieu de naissance', 'lieu naissance', 'lieu']);
  const nationalite = getValue(['nationalite', 'nationalité']);
  const telephone = getValue(['telephone parent', 'contact parent', 'telephone', 'tel']);

  if (!matricule && !nom && !prenom) return null;

  return {
    matricule: cell(matricule),
    nom: cell(nom),
    prenom: cell(prenom),
    sexe: ['M', 'F'].includes(sexe) ? sexe : '',
    date_naissance: dateNaissance,
    lieu_naissance: cell(lieu),
    nationalite: cell(nationalite),
    telephone: cell(telephone),
  };
};

export const validateExcelFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Aucun fichier fourni' });
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(req.file.path);

    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      return res.status(400).json({ error: 'Aucune feuille trouvée' });
    }

    const rows = [];
    const errors = [];

    const headerRow = worksheet.getRow(1);
    const rawHeaders = Array.isArray(headerRow?.values) ? headerRow.values.slice(1) : [];
    const headers = rawHeaders.map(normalizeHeader);

    worksheet.eachRow((row, index) => {
      if (index === 1) return;

      const student = parseExcelRow(row, headers);
      if (!student) return;

      const rowErrors = [];
      if (!student.matricule) rowErrors.push(`Ligne ${index}: matricule manquant`);
      if (!student.nom) rowErrors.push(`Ligne ${index}: nom manquant`);
      if (!student.prenom) rowErrors.push(`Ligne ${index}: prénom manquant`);
      if (!['M', 'F'].includes(student.sexe)) rowErrors.push(`Ligne ${index}: sexe doit être M ou F`);
      if (!student.date_naissance) rowErrors.push(`Ligne ${index}: date invalide (JJ/MM/AAAA)`);

      if (rowErrors.length) errors.push(...rowErrors);
      else rows.push(student);
    });

    const seen = new Set();
    for (const r of rows) {
      const normalizedMatricule = (r.matricule || '').trim().toUpperCase();
      if (!normalizedMatricule) continue;
      if (seen.has(normalizedMatricule)) {
        errors.push(`Matricule en doublon dans le fichier: ${normalizedMatricule}`);
      }
      seen.add(normalizedMatricule);
    }

    for (const r of rows) {
      const normalizedMatricule = (r.matricule || '').trim().toUpperCase();
      if (!normalizedMatricule) continue;
      const existing = await Student.findByMatricule(normalizedMatricule);
      if (existing) {
        errors.push(`Matricule déjà existant dans la base: ${normalizedMatricule}`);
      }
    }

    res.json({
      valid: errors.length === 0,
      data: rows,
      errors,
      totalRows: rows.length,
    });
  } catch (error) {
    logger.error(`Excel validation error: ${error.message}`);
    res.status(500).json({ error: 'Erreur lors de la validation du fichier Excel' });
  }
};

export const importStudents = async (req, res) => {
  try {
    const { classId } = req.params;
    const students = req.body.students || req.body.data;

    if (!Array.isArray(students) || students.length === 0) {
      return res.status(400).json({ error: 'Aucun élève à importer' });
    }

    const classData = await Class.findById(classId);
    if (!classData) {
      return res.status(404).json({ error: 'Classe non trouvée' });
    }

    const errors = [];
    const imported = [];
    const seenInFile = new Set();

    for (const s of students) {
      if (!s || !s.matricule) {
        errors.push('Une ligne du fichier est incomplète');
        continue;
      }

      const normalizedMatricule = s.matricule.trim().toUpperCase();
      if (seenInFile.has(normalizedMatricule)) {
        errors.push(`${normalizedMatricule}: matricule en doublon dans le fichier`);
        continue;
      }
      seenInFile.add(normalizedMatricule);

      try {
        const existing = await Student.findByMatricule(normalizedMatricule);
        if (existing) {
          errors.push(`${normalizedMatricule}: matricule déjà existant dans la base, impossible à importer`);
          continue;
        }

        const student = await Student.create(classId, {
          ...s,
          matricule: normalizedMatricule,
          photo_path: null,
        });
        imported.push(student);
      } catch (err) {
        errors.push(`${normalizedMatricule}: ${err.message}`);
      }
    }

    logger.info(`Imported ${imported.length} students to class ${classId}`);
    res.json({ imported: imported.length, errors, students: imported });
  } catch (error) {
    logger.error(`Import error: ${error.message}`);
    res.status(500).json({ error: "Erreur lors de l'import des élèves" });
  }
};

export const downloadTemplate = async (req, res) => {
  try {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Élèves');

    worksheet.columns = [
      { header: 'Matricule', key: 'matricule', width: 15 },
      { header: 'Nom', key: 'nom', width: 20 },
      { header: 'Prénom(s)', key: 'prenom', width: 24 },
      { header: 'Sexe (M/F)', key: 'sexe', width: 12 },
      { header: 'Date de naissance (JJ/MM/AAAA)', key: 'date_naissance', width: 28 },
      { header: 'Lieu de naissance', key: 'lieu_naissance', width: 22 },
      { header: 'Nationalité', key: 'nationalite', width: 16 },
      { header: 'Téléphone parent/tuteur', key: 'telephone', width: 20 },
    ];

    worksheet.getRow(1).font = { bold: true };

    worksheet.addRow({
      matricule: '001',
      nom: 'XXXXXXX',
      prenom: 'AAAAA BBBBBB',
      sexe: 'M',
      date_naissance: '01/02/2009',
      lieu_naissance: 'Cotonou',
      nationalite: 'BENINOISE',
      telephone: '0156435678',
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="template_eleves.xlsx"');

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    logger.error(`Template download error: ${error.message}`);
    res.status(500).json({ error: 'Erreur lors du téléchargement du template' });
  }
};