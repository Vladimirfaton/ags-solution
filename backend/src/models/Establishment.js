import { randomUUID } from 'crypto';
import { query } from '../config/database.js';

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
    const result = await query(`INSERT INTO annees_scolaires (libelle, date_debut, date_fin, statut) VALUES ($1, $2, $3, 'brouillon') RETURNING *`, [libelle.trim(), debut, fin]);
    return result.rows[0];
  }
  static async listSchoolYears() { const result = await query('SELECT * FROM annees_scolaires ORDER BY date_debut DESC'); return result.rows; }
  static async activateSchoolYear(id) {
    const client = await query('SELECT id FROM annees_scolaires WHERE id = $1 AND statut = \'brouillon\'', [id]);
    if (!client.rowCount) return null;
    await query("UPDATE annees_scolaires SET statut = 'archivee', cloturee_at = CURRENT_TIMESTAMP WHERE statut = 'active'");
    const result = await query("UPDATE annees_scolaires SET statut = 'active', updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *", [id]);
    return result.rows[0];
  }
  static async closeSchoolYear(id) { const result = await query("UPDATE annees_scolaires SET statut = 'archivee', cloturee_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND statut = 'active' RETURNING *", [id]); return result.rows[0] || null; }
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
