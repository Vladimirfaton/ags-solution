import { randomUUID } from 'crypto';
import { pool, query } from '../config/database.js';
import { FinancialObligation } from './FinancialObligation.js';
import { scopedWhere } from './AccessScope.js';

const FIELDS = `id, matricule, nom, prenom, sexe, TO_CHAR(date_naissance, 'YYYY-MM-DD') AS date_naissance, lieu_naissance, nationalite, telephone, created_at, updated_at`;

export class StudentRegistry {
  static async list(search = '', scope = { allSites: true, siteIds: [] }) {
    const term = `%${search.trim()}%`;
    const siteFilter = scopedWhere(scope, 'i.site_id', 2);
    const result = await query(`SELECT DISTINCT e.id, e.matricule, e.nom, e.prenom, e.sexe,
      TO_CHAR(e.date_naissance, 'YYYY-MM-DD') AS date_naissance, e.lieu_naissance, e.nationalite,
      e.telephone, e.created_at, e.updated_at
      FROM eleves e
      JOIN inscriptions i ON i.eleve_id = e.id
      WHERE ($1 = '%%' OR e.matricule ILIKE $1 OR e.nom ILIKE $1 OR e.prenom ILIKE $1)
        AND i.statut = 'active'
        AND i.annee_scolaire_id = (SELECT id FROM annees_scolaires WHERE statut = 'active')${siteFilter.sql}
      ORDER BY e.nom ASC, e.prenom ASC LIMIT 100`, [term, ...siteFilter.params]);
    return result.rows;
  }
    static async create(data, userId, scope = { allSites: true, siteIds: [] }) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const context = await client.query("SELECT id AS annee_id FROM annees_scolaires WHERE statut = 'active'");
      if (!context.rowCount) throw Object.assign(new Error('Configurez une année scolaire active.'), { status: 400, expose: true });
      const siteFilter = scope.allSites ? '' : ' AND site_id = ANY($3::uuid[])';
      const annualClass = await client.query(
        `SELECT id, site_id FROM classes_annuelles
        WHERE id = $1 AND annee_scolaire_id = $2 AND actif = true${siteFilter}`,
        scope.allSites
          ? [data.annualClassId, context.rows[0].annee_id]
          : [data.annualClassId, context.rows[0].annee_id, scope.siteIds]
      );
      if (!annualClass.rowCount) throw Object.assign(new Error('Classe annuelle invalide ou fermée.'), { status: 400, expose: true });
      const existing = await client.query('SELECT id FROM eleves WHERE matricule = $1', [data.matricule.trim()]);
      if (existing.rowCount) throw Object.assign(new Error('Ce matricule existe déjà dans le registre.'), { status: 409, expose: true });
      const student = await client.query(`INSERT INTO eleves (id, matricule, nom, prenom, sexe, date_naissance, lieu_naissance, nationalite, telephone)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING ${FIELDS}`,
      [randomUUID(), data.matricule.trim(), data.nom.trim(), data.prenom.trim(), data.sexe || null, data.date_naissance || null, data.lieu_naissance?.trim() || null, data.nationalite?.trim() || null, data.telephone?.trim() || null]);
      const enrollment = await client.query(`INSERT INTO inscriptions (eleve_id, annee_scolaire_id, site_id, type_inscription, created_by)
        VALUES ($1,$2,$3,'inscription',$4) RETURNING id`, [student.rows[0].id, context.rows[0].annee_id, annualClass.rows[0].site_id, userId]);
      await client.query('INSERT INTO affectations_inscription (inscription_id, classe_annuelle_id, created_by) VALUES ($1,$2,$3)', [enrollment.rows[0].id, data.annualClassId, userId]);
      const obligations = await FinancialObligation.createForEnrollment(client, { inscriptionId: enrollment.rows[0].id, anneeScolaireId: context.rows[0].annee_id, siteId: annualClass.rows[0].site_id, typeInscription: 'inscription' });
      await FinancialObligation.settleFees(client, { inscriptionId: enrollment.rows[0].id, obligations, paidFeeConfigIds: data.paidFeeConfigIds, userId });
      await client.query('COMMIT');
      return student.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
  static async listClasses(scope) {
    const establishment = await query('SELECT type FROM etablissement WHERE singleton = true');
    const allowedLevels = establishment.rows[0]?.type === 'primaire' ? ['CI', 'CP', 'CE1', 'CE2', 'CM1', 'CM2'] : ['6e', '5e', '4e', '3e', '2nde', '1ere', 'terminale'];
    const siteFilter = scopedWhere(scope, 'ca.site_id', 2);
    const result = await query(`SELECT ca.id, ca.code_affichage, ca.division_nom, s.nom AS site_nom, n.ordre, COUNT(ai.id)::int AS effectif
      FROM classes_annuelles ca
      JOIN classes c ON c.id = ca.classe_id JOIN niveaux_scolaires n ON n.id = c.niveau_id
        JOIN sites s ON s.id = ca.site_id
      LEFT JOIN affectations_inscription ai ON ai.classe_annuelle_id = ca.id AND ai.active = true
      WHERE ca.annee_scolaire_id = (SELECT id FROM annees_scolaires WHERE statut = 'active') AND ca.actif = true AND n.code = ANY($1::text[])${siteFilter.sql}
      GROUP BY ca.id, s.nom, n.ordre ORDER BY n.ordre, ca.division_nom`, [allowedLevels, ...siteFilter.params]);
    return result.rows;
  }
  static async listByClass(classId, scope) {
    const siteFilter = scopedWhere(scope, 'ca.site_id', 2);
    const result = await query(`SELECT ca.id AS classe_id, ca.code_affichage, e.id, e.matricule, e.nom, e.prenom, e.sexe,
      TO_CHAR(e.date_naissance, 'YYYY-MM-DD') AS date_naissance, e.lieu_naissance, e.nationalite, e.telephone
      FROM classes_annuelles ca
      LEFT JOIN affectations_inscription ai ON ai.classe_annuelle_id = ca.id AND ai.active = true
      LEFT JOIN inscriptions i ON i.id = ai.inscription_id AND i.statut = 'active'
      LEFT JOIN eleves e ON e.id = i.eleve_id
      WHERE ca.id = $1 AND ca.annee_scolaire_id = (SELECT id FROM annees_scolaires WHERE statut = 'active') AND ca.actif = true${siteFilter.sql}
      ORDER BY e.nom, e.prenom`, [classId, ...siteFilter.params]);
    return { classInfo: result.rows[0] ? { id: result.rows[0].classe_id, code_affichage: result.rows[0].code_affichage } : null, students: result.rows.filter((row) => row.id) };
  }
    static async listByArchivedClass(classId, scope) {
    const siteFilter = scopedWhere(scope, 'ca.site_id', 2);
    const result = await query(`SELECT ca.id AS classe_id, ca.code_affichage, e.id, e.matricule, e.nom, e.prenom, e.sexe,
      TO_CHAR(e.date_naissance, 'YYYY-MM-DD') AS date_naissance, e.lieu_naissance, e.nationalite, e.telephone
      FROM classes_annuelles ca
      JOIN annees_scolaires a ON a.id = ca.annee_scolaire_id AND a.statut = 'archivee'
      LEFT JOIN affectations_inscription ai ON ai.classe_annuelle_id = ca.id AND ai.active = true
      LEFT JOIN inscriptions i ON i.id = ai.inscription_id
      LEFT JOIN eleves e ON e.id = i.eleve_id
      WHERE ca.id = $1${siteFilter.sql}
      ORDER BY e.nom, e.prenom`, [classId, ...siteFilter.params]);
    return { classInfo: result.rows[0] ? { id: result.rows[0].classe_id, code_affichage: result.rows[0].code_affichage } : null, students: result.rows.filter((row) => row.id) };
  }
  static async assertStudentScope(id, scope) {
    if (scope.allSites) return;
    const result = await query(`SELECT 1 FROM inscriptions i
      WHERE i.eleve_id = $1 AND i.annee_scolaire_id = (SELECT id FROM annees_scolaires WHERE statut = 'active')
        AND i.site_id = ANY($2::uuid[])`, [id, scope.siteIds]);
    if (!result.rowCount) throw Object.assign(new Error('Élève introuvable dans votre site.'), { status: 404, expose: true });
  }
  static async update(id, data, scope) {
    await this.assertStudentScope(id, scope);
    const result = await query(`UPDATE eleves SET nom=$1, prenom=$2, sexe=$3, date_naissance=$4, lieu_naissance=$5, nationalite=$6, telephone=$7, updated_at=CURRENT_TIMESTAMP WHERE id=$8 RETURNING ${FIELDS}`,
    [data.nom.trim(), data.prenom.trim(), data.sexe || null, data.date_naissance || null, data.lieu_naissance?.trim() || null, data.nationalite?.trim() || null, data.telephone?.trim() || null, id]);
    return result.rows[0] || null;
  }
  static async transfer(studentId, destinationClassId, motif, userId, scope) {
    const cleanMotif = motif?.trim();
    if (!cleanMotif) throw Object.assign(new Error('Le motif du transfert est requis.'), { status: 400, expose: true });
    await this.assertStudentScope(studentId, scope);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const sourceSiteFilter = scope.allSites ? '' : ' AND ca.site_id = ANY($2::uuid[])';
      const source = await client.query(`SELECT i.id AS inscription_id, ai.id AS affectation_id, ca.id AS classe_id, ca.site_id
        FROM inscriptions i JOIN affectations_inscription ai ON ai.inscription_id = i.id AND ai.active = true
        JOIN classes_annuelles ca ON ca.id = ai.classe_annuelle_id
         WHERE i.eleve_id = $1 AND i.annee_scolaire_id = (SELECT id FROM annees_scolaires WHERE statut = 'active') AND i.statut = 'active'${sourceSiteFilter}
        FOR UPDATE OF i, ai`, scope.allSites ? [studentId] : [studentId, scope.siteIds]);
      const destination = await client.query(`SELECT id, site_id FROM classes_annuelles
        WHERE id = $1 AND annee_scolaire_id = (SELECT id FROM annees_scolaires WHERE statut = 'active') AND actif = true`, [destinationClassId]);
      if (!source.rowCount || !destination.rowCount) throw Object.assign(new Error('Transfert impossible : élève ou classe de destination invalide.'), { status: 400, expose: true });
      if (!scope.allSites && (!scope.siteIds.includes(source.rows[0].site_id) || !scope.siteIds.includes(destination.rows[0].site_id))) throw Object.assign(new Error('Transfert vers un site non autorisé.'), { status: 403, expose: true });
      if (source.rows[0].classe_id === destinationClassId) throw Object.assign(new Error('L’élève est déjà dans cette classe.'), { status: 409, expose: true });
      await client.query('UPDATE affectations_inscription SET active = false, date_fin = CURRENT_DATE WHERE id = $1', [source.rows[0].affectation_id]);
      await client.query('INSERT INTO affectations_inscription (inscription_id, classe_annuelle_id, created_by) VALUES ($1,$2,$3)', [source.rows[0].inscription_id, destinationClassId, userId]);
      await client.query('UPDATE inscriptions SET site_id = $1 WHERE id = $2', [destination.rows[0].site_id, source.rows[0].inscription_id]);
      await client.query(`INSERT INTO mouvements_inscription (inscription_id, type, date_effet, motif, enregistre_par)
        VALUES ($1, 'transfert_interne', CURRENT_DATE, $2, $3)`,
     [source.rows[0].inscription_id, cleanMotif, userId]);
      await client.query('COMMIT');
       return { studentId, destinationClassId, motif: cleanMotif };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally { client.release(); }
  } 
    static async listForEstablishment(search = '', scope, page = 1, pageSize = 10) {
    const siteFilter = scopedWhere(scope, 'ca.site_id', 2);
    const term = `%${search.trim()}%`;
    const offset = (Math.max(1, page) - 1) * pageSize;
    const [rows, count] = await Promise.all([
      query(`SELECT e.id, e.matricule, e.nom, e.prenom, e.sexe, ca.code_affichage, s.nom AS site_nom, n.ordre
        FROM eleves e
        JOIN inscriptions i ON i.eleve_id = e.id AND i.statut = 'active' AND i.annee_scolaire_id = (SELECT id FROM annees_scolaires WHERE statut = 'active')
        JOIN affectations_inscription ai ON ai.inscription_id = i.id AND ai.active = true
        JOIN classes_annuelles ca ON ca.id = ai.classe_annuelle_id
        JOIN classes c ON c.id = ca.classe_id
        JOIN niveaux_scolaires n ON n.id = c.niveau_id
        JOIN sites s ON s.id = ca.site_id
        WHERE (e.matricule ILIKE $1 OR e.nom ILIKE $1 OR e.prenom ILIKE $1 OR ca.code_affichage ILIKE $1)${siteFilter.sql}
        ORDER BY n.ordre, ca.division_nom, e.nom, e.prenom
        LIMIT $${siteFilter.params.length + 2} OFFSET $${siteFilter.params.length + 3}`,
        [term, ...siteFilter.params, pageSize, offset]),
      query(`SELECT COUNT(*)::int AS total
        FROM eleves e
        JOIN inscriptions i ON i.eleve_id = e.id AND i.statut = 'active' AND i.annee_scolaire_id = (SELECT id FROM annees_scolaires WHERE statut = 'active')
        JOIN affectations_inscription ai ON ai.inscription_id = i.id AND ai.active = true
        JOIN classes_annuelles ca ON ca.id = ai.classe_annuelle_id
        WHERE (e.matricule ILIKE $1 OR e.nom ILIKE $1 OR e.prenom ILIKE $1 OR ca.code_affichage ILIKE $1)${siteFilter.sql}`,
        [term, ...siteFilter.params]),
    ]);
    return { students: rows.rows, total: count.rows[0].total, page, pageSize };
  }
}
