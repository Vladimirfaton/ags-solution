import { randomUUID } from 'crypto';
import { pool, query } from '../config/database.js';

export class Establishment {
  static async get() { const result = await query('SELECT * FROM etablissement WHERE singleton = true'); return result.rows[0] || null; }
  static async create({ nom, type, commune, departement, email, telephone, adressePostale }) {
    const result = await query(`INSERT INTO etablissement (id, nom, type, commune, departement, email, telephone, adresse_postale) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`, [randomUUID(), nom.trim(), type || 'college', commune?.trim() || null, departement?.trim() || null, email?.trim().toLowerCase() || null, telephone?.trim() || null, adressePostale?.trim() || null]);
    return result.rows[0];
  }
  static async createPrimarySite({ nom, adresse, commune, departement, telephone, email }) {
    const result = await query(`INSERT INTO sites (nom, est_principal, adresse, commune, departement, telephone, email) VALUES ($1, true, $2, $3, $4, $5, $6) RETURNING *`, [nom.trim(), adresse?.trim() || null, commune?.trim() || null, departement?.trim() || null, telephone?.trim() || null, email?.trim().toLowerCase() || null]);
    return result.rows[0];
  }
  static async createSite({ nom, adresse, commune, departement, telephone, email }) {
    const result = await query(`INSERT INTO sites (nom, adresse, commune, departement, telephone, email)
      VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`, [nom.trim(), adresse?.trim() || null, commune?.trim() || null, departement?.trim() || null, telephone?.trim() || null, email?.trim().toLowerCase() || null]);
    return result.rows[0];
  }
    static async createSchoolYear({ libelle, moisDebut, moisFin }) {
    const debut = `${moisDebut}-01`;
    const fin = `${moisFin}-01`;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const pending = await client.query("SELECT 1 FROM annees_scolaires WHERE statut = 'brouillon'");
      if (pending.rowCount) throw Object.assign(new Error('Une année en brouillon existe déjà. Activez-la avant d’en créer une autre.'), { status: 400, expose: true });
      const source = await client.query(`SELECT id, EXTRACT(YEAR FROM date_debut)::int AS annee FROM annees_scolaires WHERE statut IN ('active', 'archivee') ORDER BY (statut = 'active') DESC, date_debut DESC LIMIT 1`);
      const created = await client.query(`INSERT INTO annees_scolaires (libelle, date_debut, date_fin, statut) VALUES ($1, $2, $3, 'brouillon') RETURNING *`, [libelle.trim(), debut, fin]);
      const year = created.rows[0];
      if (source.rowCount) {
        const yearOffset = Number(moisDebut.slice(0, 4)) - source.rows[0].annee;
        await this.copyConfiguration(client, source.rows[0].id, year.id, yearOffset);
      }
      await client.query('COMMIT');
      return year;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
  static async copyConfiguration(client, sourceYearId, targetYearId, yearOffset) {
    await client.query(`INSERT INTO classes_annuelles (annee_scolaire_id, site_id, classe_id, division_nom, division_type, code_affichage, actif)
      SELECT $2, site_id, classe_id, division_nom, division_type, code_affichage, true
      FROM classes_annuelles WHERE annee_scolaire_id = $1 AND actif = true`, [sourceYearId, targetYearId]);
    await client.query(`INSERT INTO frais_generaux_config (annee_scolaire_id, site_id, nom, montant, applicable_a, obligatoire, ordre, actif)
      SELECT $2, site_id, nom, montant, applicable_a, obligatoire, ordre, true
      FROM frais_generaux_config WHERE annee_scolaire_id = $1 AND actif = true`, [sourceYearId, targetYearId]);
    await client.query(`INSERT INTO plans_tarifaires (annee_scolaire_id, site_id, classe_id, division_nom, montant_total, actif)
      SELECT $2, site_id, classe_id, division_nom, montant_total, true
      FROM plans_tarifaires WHERE annee_scolaire_id = $1 AND actif = true`, [sourceYearId, targetYearId]);
    await client.query(`INSERT INTO tranches_tarifaires (plan_tarifaire_id, ordre, nom, montant, date_echeance, actif)
      SELECT np.id, tt.ordre, tt.nom, tt.montant, (tt.date_echeance + make_interval(years => $3::int))::date, true
      FROM tranches_tarifaires tt
      JOIN plans_tarifaires op ON op.id = tt.plan_tarifaire_id AND op.annee_scolaire_id = $1 AND op.actif = true
      JOIN plans_tarifaires np ON np.annee_scolaire_id = $2 AND np.site_id = op.site_id AND np.classe_id = op.classe_id AND np.division_nom IS NOT DISTINCT FROM op.division_nom
      WHERE tt.actif = true`, [sourceYearId, targetYearId, yearOffset]);
  }
  static async listSchoolYears() { const result = await query('SELECT * FROM annees_scolaires ORDER BY date_debut DESC'); return result.rows; }
    static async activateSchoolYear(id) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const draft = await client.query("SELECT id FROM annees_scolaires WHERE id = $1 AND statut = 'brouillon' FOR UPDATE", [id]);
      if (!draft.rowCount) {
        await client.query('ROLLBACK');
        return null;
      }
      await client.query("UPDATE annees_scolaires SET statut = 'archivee', cloturee_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE statut = 'active'");
      const result = await client.query("UPDATE annees_scolaires SET statut = 'active', updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *", [id]);
      await client.query('COMMIT');
      return result.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
  static async closeSchoolYear(id) { const result = await query("UPDATE annees_scolaires SET statut = 'archivee', cloturee_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND statut = 'active' RETURNING *", [id]); return result.rows[0] || null; }
  static async listYearClasses(yearId) {
    const result = await query(`SELECT ca.id, ca.code_affichage, s.nom AS site_nom, COUNT(ai.id)::int AS effectif
      FROM classes_annuelles ca
      JOIN sites s ON s.id = ca.site_id
      LEFT JOIN affectations_inscription ai ON ai.classe_annuelle_id = ca.id AND ai.active = true
      WHERE ca.annee_scolaire_id = $1 AND ca.actif = true
      GROUP BY ca.id, s.nom ORDER BY s.nom, ca.code_affichage`, [yearId]);
    return result.rows;
  }
  static async adminOverview() {
    const [etablissement, sites, comptes] = await Promise.all([
      this.get(),
      query('SELECT id, nom, est_principal, actif, commune, departement FROM sites ORDER BY est_principal DESC, nom ASC'),
      query("SELECT id, role, username, nom, prenom, status, password_personalized FROM users ORDER BY CASE role WHEN 'directeur' THEN 1 WHEN 'secretaire' THEN 2 WHEN 'comptable' THEN 3 WHEN 'censeur' THEN 4 END"),
    ]);
    return { etablissement, sites: sites.rows, comptes: comptes.rows };
  }
  static async directorOverview() {
    const [etablissement, sites, anneeActive, comptes, classes] = await Promise.all([
      this.get(),
      query(`SELECT s.id, s.nom, s.est_principal, s.actif,
        COUNT(DISTINCT ca.id)::int AS classes_count,
        COUNT(DISTINCT i.eleve_id) FILTER (WHERE i.statut = 'active')::int AS students_count
        FROM sites s
        LEFT JOIN classes_annuelles ca ON ca.site_id = s.id
          AND ca.annee_scolaire_id = (SELECT id FROM annees_scolaires WHERE statut = 'active')
        LEFT JOIN inscriptions i ON i.site_id = s.id
          AND i.annee_scolaire_id = (SELECT id FROM annees_scolaires WHERE statut = 'active')
        GROUP BY s.id ORDER BY s.est_principal DESC, s.nom ASC`),
      query("SELECT id, libelle, date_debut, date_fin FROM annees_scolaires WHERE statut = 'active'"),
      query("SELECT id, role, username, nom, prenom, status, password_personalized FROM users ORDER BY CASE role WHEN 'directeur' THEN 1 WHEN 'secretaire' THEN 2 WHEN 'comptable' THEN 3 WHEN 'censeur' THEN 4 END"),
      query(`SELECT ca.id, ca.code_affichage, s.nom AS site_nom, COUNT(ai.id)::int AS effectif
        FROM classes_annuelles ca
        JOIN sites s ON s.id = ca.site_id
        LEFT JOIN affectations_inscription ai ON ai.classe_annuelle_id = ca.id AND ai.active = true
        WHERE ca.annee_scolaire_id = (SELECT id FROM annees_scolaires WHERE statut = 'active') AND ca.actif = true
        GROUP BY ca.id, s.nom ORDER BY s.nom, ca.code_affichage`),
    ]);
    return { etablissement, sites: sites.rows, anneeActive: anneeActive.rows[0] || null, comptes: comptes.rows, classes: classes.rows };
  }
  static async setupStatus() {
    const result = await query(`SELECT EXISTS(SELECT 1 FROM etablissement) AS etablissement_cree, EXISTS(SELECT 1 FROM sites WHERE est_principal = true) AS site_principal_cree, EXISTS(SELECT 1 FROM annees_scolaires WHERE statut = 'active') AS annee_active_creee`);
    return result.rows[0];
  }
}
