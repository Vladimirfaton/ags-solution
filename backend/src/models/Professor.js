import { randomUUID } from 'crypto';
import { query } from '../config/database.js';
import { resolveScopedSite } from './AccessScope.js';

const fail = (message, status = 400) => {
  throw Object.assign(new Error(message), { status, expose: true });
};

const scopedFilter = (scope, column, index) => (
  scope.allSites
    ? { sql: '', params: [] }
    : { sql: ` AND ${column} = ANY($${index}::uuid[])`, params: [scope.siteIds] }
);

export class Subject {
  static async list() {
    const result = await query(
      'SELECT id, nom, code, actif FROM matieres ORDER BY nom'
    );
    return result.rows;
  }

  static async create({ nom, code }) {
    if (!nom?.trim()) fail('Le nom de la matière est requis.');
    const result = await query(
      `INSERT INTO matieres (id, nom, code)
       VALUES ($1,$2,$3)
       RETURNING id, nom, code, actif`,
      [randomUUID(), nom.trim(), code?.trim().toUpperCase() || null]
    );
    return result.rows[0];
  }

  static async update(id, { nom, code, actif }) {
    if (!nom?.trim()) fail('Le nom de la matière est requis.');
    const result = await query(
      `UPDATE matieres
       SET nom = $1, code = $2, actif = $3, updated_at = CURRENT_TIMESTAMP
       WHERE id = $4
       RETURNING id, nom, code, actif`,
      [nom.trim(), code?.trim().toUpperCase() || null, Boolean(actif), id]
    );
    if (!result.rowCount) fail('Matière introuvable.', 404);
    return result.rows[0];
  }
}

export class Professor {
  static async list(scope) {
    const filter = scopedFilter(scope, 'p.site_id', 1);
    const result = await query(
      `SELECT p.id, p.site_id, p.nom, p.prenom, p.sexe, p.telephone, p.email,
        p.actif, s.nom AS site_nom,
        COUNT(a.id) FILTER (WHERE a.actif = true)::int AS affectations_actives
       FROM professeurs p
       JOIN sites s ON s.id = p.site_id
       LEFT JOIN affectations_professeurs a ON a.professeur_id = p.id
       WHERE true${filter.sql}
       GROUP BY p.id, s.nom
       ORDER BY p.nom, p.prenom`,
      filter.params
    );
    return result.rows;
  }

  static async create(data, userId, scope) {
    if (!data.nom?.trim() || !data.prenom?.trim()) {
      fail('Nom et prénom sont requis.');
    }
    if (data.sexe && !['M', 'F'].includes(data.sexe)) {
      fail('Le sexe doit être M ou F.');
    }

    const siteId = await resolveScopedSite(scope, data.siteId);
    const result = await query(
      `INSERT INTO professeurs
        (id, site_id, nom, prenom, sexe, telephone, email, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING id, site_id, nom, prenom, sexe, telephone, email, actif`,
      [
        randomUUID(),
        siteId,
        data.nom.trim(),
        data.prenom.trim(),
        data.sexe || null,
        data.telephone?.trim() || null,
        data.email?.trim().toLowerCase() || null,
        userId,
      ]
    );
    return result.rows[0];
  }

  static async update(id, data, scope) {
    if (!data.nom?.trim() || !data.prenom?.trim()) {
      fail('Nom et prénom sont requis.');
    }
    if (data.sexe && !['M', 'F'].includes(data.sexe)) {
      fail('Le sexe doit être M ou F.');
    }

    const filter = scopedFilter(scope, 'site_id', 2);
    const result = await query(
      `UPDATE professeurs
       SET nom = $1, prenom = $2, sexe = $3, telephone = $4, email = $5,
         actif = $6, updated_at = CURRENT_TIMESTAMP
       WHERE id = $7${filter.sql}
       RETURNING id, site_id, nom, prenom, sexe, telephone, email, actif`,
      [
        data.nom.trim(),
        data.prenom.trim(),
        data.sexe || null,
        data.telephone?.trim() || null,
        data.email?.trim().toLowerCase() || null,
        Boolean(data.actif),
        id,
        ...filter.params,
      ]
    );
    if (!result.rowCount) fail('Professeur introuvable dans votre site.', 404);
    return result.rows[0];
  }

  static async assignments(professorId, scope) {
    const filter = scopedFilter(scope, 'p.site_id', 2);
    const result = await query(
      `SELECT a.id, a.role, a.actif, a.date_debut, a.date_fin,
        ca.id AS classe_annuelle_id, ca.code_affichage,
        m.id AS matiere_id, m.nom AS matiere_nom
       FROM affectations_professeurs a
       JOIN professeurs p ON p.id = a.professeur_id
       JOIN classes_annuelles ca ON ca.id = a.classe_annuelle_id
       LEFT JOIN matieres m ON m.id = a.matiere_id
       WHERE p.id = $1${filter.sql}
       ORDER BY a.actif DESC, ca.code_affichage, m.nom`,
      [professorId, ...filter.params]
    );
    return result.rows;
  }

  static async assign({ professorId, annualClassId, matiereId }, userId, scope) {
    const professorFilter = scopedFilter(scope, 'p.site_id', 2);
    const professor = await query(
      `SELECT p.id, p.site_id
       FROM professeurs p
       WHERE p.id = $1 AND p.actif = true${professorFilter.sql}`,
      [professorId, ...professorFilter.params]
    );
    if (!professor.rowCount) fail('Professeur introuvable ou inactif.', 404);

    const classFilter = scopedFilter(scope, 'ca.site_id', 2);
    const annualClass = await query(
      `SELECT ca.id, ca.site_id
       FROM classes_annuelles ca
       WHERE ca.id = $1
         AND ca.annee_scolaire_id = (SELECT id FROM annees_scolaires WHERE statut = 'active')
         AND ca.actif = true${classFilter.sql}`,
      [annualClassId, ...classFilter.params]
    );
    if (!annualClass.rowCount) fail('Classe annuelle introuvable ou inactive.', 404);
    if (annualClass.rows[0].site_id !== professor.rows[0].site_id) {
      fail('Le professeur et la classe doivent appartenir au même site.');
    }

    const establishment = await query(
      'SELECT type FROM etablissement WHERE singleton = true'
    );
    if (!establishment.rowCount) fail('Établissement non configuré.');

    const isPrimary = establishment.rows[0].type === 'primaire';
    if (!isPrimary && !matiereId) {
      fail('Une matière est obligatoire pour une affectation au collège ou au lycée.');
    }
    if (matiereId) {
      const subject = await query(
        'SELECT id FROM matieres WHERE id = $1 AND actif = true',
        [matiereId]
      );
      if (!subject.rowCount) fail('Matière introuvable ou inactive.', 404);
    }

    const result = await query(
      `INSERT INTO affectations_professeurs
        (professeur_id, classe_annuelle_id, matiere_id, role, created_by)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING id, professeur_id, classe_annuelle_id, matiere_id, role, actif`,
      [
        professorId,
        annualClassId,
        matiereId || null,
        matiereId ? 'enseignement' : 'titulaire',
        userId,
      ]
    );
    return result.rows[0];
  }

  static async endAssignment(id, scope) {
    const filter = scopedFilter(scope, 'p.site_id', 2);
    const result = await query(
      `UPDATE affectations_professeurs a
       SET actif = false, date_fin = CURRENT_DATE
       FROM professeurs p
       WHERE a.professeur_id = p.id
         AND a.id = $1
         AND a.actif = true${filter.sql}
       RETURNING a.id, a.actif, a.date_fin`,
      [id, ...filter.params]
    );
    if (!result.rowCount) fail('Affectation active introuvable.', 404);
    return result.rows[0];
  }
}
