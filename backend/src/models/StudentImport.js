import { randomUUID } from 'crypto';
import ExcelJS from 'exceljs';
import { pool, query } from '../config/database.js';
import { FinancialObligation } from './FinancialObligation.js';
import { resolveScopedSite } from './AccessScope.js';

const fail = (message, status = 400, details = null) => {
  const error = Object.assign(new Error(message), { status, expose: true });
  if (details) error.details = details;
  throw error;
};

const text = (value) => {
  if (value == null) return '';
  if (typeof value === 'object') {
    if (value.richText) return value.richText.map((part) => part.text).join('').trim();
    if (value.result != null) return text(value.result);
  }
  return String(value).trim();
};

const normalize = (value) => text(value)
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const classKey = (value) => normalize(value);

const isoDate = (year, month, day) => {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
  ) return null;

  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

const parseDate = (value) => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return isoDate(value.getFullYear(), value.getMonth() + 1, value.getDate());
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    const excelBase = new Date(Date.UTC(1899, 11, 30));
    const date = new Date(excelBase.getTime() + value * 86400000);
    return isoDate(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
  }

  const valueText = text(value);
  const iso = valueText.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return isoDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));

  const french = valueText.match(/^(\d{1,2})[/. -](\d{1,2})[/. -](\d{4})$/);
  if (french) return isoDate(Number(french[3]), Number(french[2]), Number(french[1]));

  return null;
};

const parseBirthPair = (value) => {
  const valueText = text(value);
  const datePattern = '(\\d{1,2}[/. -]\\d{1,2}[/. -]\\d{4}|\\d{4}-\\d{2}-\\d{2})';
  const match = valueText.match(
    new RegExp(`^\\s*${datePattern}\\s*(?:à|a|[-–—,;])\\s*(.+?)\\s*$`, 'i')
  );

  if (!match) return { dateNaissance: parseDate(value), lieuNaissance: '' };

  return {
    dateNaissance: parseDate(match[1]),
    lieuNaissance: text(match[2]),
  };
};

const findColumn = (headers, aliases) => headers.findIndex(
  (header) => aliases.includes(header)
);

const headerIndexes = (headerValues) => {
  const headers = headerValues.map(normalize);

  return {
    matricule: findColumn(headers, ['matricule']),
    nom: findColumn(headers, ['nom']),
    prenom: findColumn(headers, ['prenom', 'prenoms', 'prenom s']),
    dateNaissance: findColumn(headers, ['date de naissance', 'date naissance']),
    lieuNaissance: findColumn(headers, ['lieu de naissance', 'lieu naissance']),
    naissanceGroupe: findColumn(headers, [
      'date et lieu de naissance',
      'date lieu de naissance',
      'ne le a',
    ]),
    sexe: findColumn(headers, ['sexe']),
    nationalite: findColumn(headers, ['nationalite']),
    adresse: findColumn(headers, ['contact parent']),
    classe: findColumn(headers, ['classe']),
  };
};

const parseWorkbook = async (buffer) => {
  if (!buffer?.length) fail('Le fichier Excel est requis.');

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const worksheet = workbook.worksheets[0];
  if (!worksheet) fail('Le fichier ne contient aucune feuille.');

  const indexes = headerIndexes(worksheet.getRow(1).values.slice(1));
  const missingHeaders = [];

  for (const field of ['matricule', 'nom', 'prenom', 'sexe', 'nationalite', 'adresse', 'classe']) {
    if (indexes[field] < 0) missingHeaders.push(field);
  }

  if (indexes.dateNaissance < 0 && indexes.naissanceGroupe < 0) {
    missingHeaders.push('date de naissance');
  }
  if (indexes.lieuNaissance < 0 && indexes.naissanceGroupe < 0) {
    missingHeaders.push('lieu de naissance');
  }

  if (missingHeaders.length) {
    return {
      rows: [],
      errors: [{
        line: 1,
        messages: [`Colonne(s) manquante(s) : ${missingHeaders.join(', ')}.`],
      }],
    };
  }

  const rows = [];

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;

    const values = row.values.slice(1);
    if (!values.some((value) => text(value))) return;

    const valueAt = (index) => (index < 0 ? null : row.getCell(index + 1).value);
    const groupedBirth = indexes.naissanceGroupe < 0
      ? { dateNaissance: null, lieuNaissance: '' }
      : parseBirthPair(valueAt(indexes.naissanceGroupe));

    rows.push({
      line: rowNumber,
      matricule: text(valueAt(indexes.matricule)).toUpperCase(),
      nom: text(valueAt(indexes.nom)),
      prenom: text(valueAt(indexes.prenom)),
      date_naissance: parseDate(valueAt(indexes.dateNaissance)) || groupedBirth.dateNaissance,
      lieu_naissance: text(valueAt(indexes.lieuNaissance)) || groupedBirth.lieuNaissance,
      sexe: text(valueAt(indexes.sexe)).toUpperCase(),
      nationalite: text(valueAt(indexes.nationalite)),
      adresse: text(valueAt(indexes.adresse)),
      classe: text(valueAt(indexes.classe)),
    });
  });

  return { rows, errors: [] };
};

export class StudentImport {
  static async review(rows, siteId, executor = query) {
    const activeYear = await executor(
      "SELECT id FROM annees_scolaires WHERE statut = 'active'"
    );
    if (!activeYear.rowCount) fail('Aucune année scolaire active.');

    const classes = await executor(
      `SELECT ca.id, ca.code_affichage,
        EXISTS (
          SELECT 1
          FROM plans_tarifaires pt
          JOIN tranches_tarifaires tt
            ON tt.plan_tarifaire_id = pt.id AND tt.actif = true
          WHERE pt.annee_scolaire_id = ca.annee_scolaire_id
            AND pt.site_id = ca.site_id
            AND pt.classe_id = ca.classe_id
            AND pt.division_nom IS NOT DISTINCT FROM ca.division_nom
            AND pt.actif = true
        ) AS tarif_configure
       FROM classes_annuelles ca
       WHERE ca.annee_scolaire_id = $1
         AND ca.site_id = $2
         AND ca.actif = true`,
      [activeYear.rows[0].id, siteId]
    );

    const classesByName = new Map(
      classes.rows.map((annualClass) => [
        classKey(annualClass.code_affichage),
        annualClass,
      ])
    );

    const errors = new Map();
    const addError = (line, message) => {
      if (!errors.has(line)) errors.set(line, []);
      errors.get(line).push(message);
    };

    const matricules = new Map();

    for (const row of rows) {
      if (!row.matricule) addError(row.line, 'Matricule manquant.');
      if (!row.nom) addError(row.line, 'Nom manquant.');
      if (!row.prenom) addError(row.line, 'Prénom(s) manquant(s).');
      if (!row.date_naissance) addError(row.line, 'Date de naissance invalide ou manquante.');
      if (!row.lieu_naissance) addError(row.line, 'Lieu de naissance manquant.');
      if (!['M', 'F'].includes(row.sexe)) addError(row.line, 'Sexe invalide : utilisez M ou F.');
      if (!row.classe) addError(row.line, 'Classe manquante.');

      if (row.matricule) {
        if (matricules.has(row.matricule)) {
          addError(row.line, `Matricule en doublon avec la ligne ${matricules.get(row.matricule)}.`);
          addError(matricules.get(row.matricule), `Matricule en doublon avec la ligne ${row.line}.`);
        } else {
          matricules.set(row.matricule, row.line);
        }
      }

      const annualClass = classesByName.get(classKey(row.classe));
      if (row.classe && !annualClass) {
        addError(row.line, `Classe introuvable ou inactive : « ${row.classe} ».`);
      } else if (annualClass && !annualClass.tarif_configure) {
        addError(
          row.line,
          `Les frais ou les échéances de « ${annualClass.code_affichage} » ne sont pas configurés.`
        );
      }
    }

    const importedMatricules = [...matricules.keys()];
    if (importedMatricules.length) {
      const existing = await executor(
        `SELECT UPPER(matricule) AS matricule
         FROM eleves
         WHERE UPPER(matricule) = ANY($1::text[])`,
        [importedMatricules]
      );

      const existingMatricules = new Set(existing.rows.map((row) => row.matricule));
      for (const row of rows) {
        if (existingMatricules.has(row.matricule)) {
          addError(row.line, `Matricule déjà présent dans le registre : ${row.matricule}.`);
        }
      }
    }

    const validRows = rows
      .filter((row) => !errors.has(row.line))
      .map((row) => ({
        ...row,
        annualClassId: classesByName.get(classKey(row.classe)).id,
      }));

    return {
      yearId: activeYear.rows[0].id,
      rows: validRows,
      errors: [...errors.entries()]
        .map(([line, messages]) => ({ line, messages }))
        .sort((a, b) => a.line - b.line),
    };
  }

  static async preview(buffer, scope, requestedSiteId) {
    const siteId = await resolveScopedSite(scope, requestedSiteId);
    const parsed = await parseWorkbook(buffer);
    if (parsed.errors.length) {
      return {
        siteId,
        valid: false,
        totalRows: 0,
        rows: [],
        errors: parsed.errors,
      };
    }

    const review = await this.review(parsed.rows, siteId);
    return {
      siteId,
      valid: review.errors.length === 0,
      totalRows: parsed.rows.length,
      rows: review.rows,
      errors: review.errors,
    };
  }

  static async import(buffer, userId, scope, requestedSiteId) {
    const siteId = await resolveScopedSite(scope, requestedSiteId);
    const parsed = await parseWorkbook(buffer);
    if (parsed.errors.length) fail('Le fichier Excel est invalide.', 400, parsed.errors);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Empêche deux imports de créer le même matricule au même moment.
      const sortedMatricules = [...new Set(parsed.rows.map((row) => row.matricule))].sort();
      for (const matricule of sortedMatricules) {
        await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [matricule]);
      }

      const review = await this.review(
        parsed.rows,
        siteId,
        (textQuery, params) => client.query(textQuery, params)
      );
      if (review.errors.length) fail('Le fichier contient des erreurs.', 400, review.errors);
      if (!review.rows.length) fail('Le fichier ne contient aucun élève à importer.');

      const students = [];

      for (const row of review.rows) {
        const student = await client.query(
          `INSERT INTO eleves
            (id, matricule, nom, prenom, sexe, date_naissance, lieu_naissance, nationalite, adresse)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
           RETURNING id, matricule, nom, prenom`,
          [
            randomUUID(),
            row.matricule,
            row.nom,
            row.prenom,
            row.sexe,
            row.date_naissance,
            row.lieu_naissance,
            row.nationalite || null,
            row.adresse || null,
          ]
        );

        const enrollment = await client.query(
          `INSERT INTO inscriptions
            (eleve_id, annee_scolaire_id, site_id, type_inscription, created_by)
           VALUES ($1,$2,$3,'inscription',$4)
           RETURNING id`,
          [student.rows[0].id, review.yearId, siteId, userId]
        );

        await client.query(
          `INSERT INTO affectations_inscription
            (inscription_id, classe_annuelle_id, created_by)
           VALUES ($1,$2,$3)`,
          [enrollment.rows[0].id, row.annualClassId, userId]
        );

        await FinancialObligation.createForEnrollment(client, {
          inscriptionId: enrollment.rows[0].id,
          anneeScolaireId: review.yearId,
          siteId,
          typeInscription: 'inscription',
        });

        students.push(student.rows[0]);
      }

      await client.query('COMMIT');
      return { imported: students.length, students };
    } catch (error) {
      await client.query('ROLLBACK');
      if (error.code === '23505') {
        fail('Un matricule vient déjà d’être créé. Relancez l’aperçu avant de confirmer.', 409);
      }
      throw error;
    } finally {
      client.release();
    }
  }
}