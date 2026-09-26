import { query } from '../config/database.js';
import { scopedWhere } from './AccessScope.js';

const CARD_FIELDS = `e.id, e.matricule, e.nom, e.prenom, e.sexe,
  TO_CHAR(e.date_naissance, 'YYYY-MM-DD') AS date_naissance,
  e.lieu_naissance, e.nationalite, e.telephone, e.photo_path`;

const unavailable = () => Object.assign(new Error('Le service Cartes FVS n’est pas activé pour cet établissement.'), { status: 403, expose: true });

export class CardService {
  static async status() {
    const result = await query("SELECT code, libelle, actif, active_at FROM modules_plateforme WHERE code = 'cartes'");
    return result.rows[0] || { code: 'cartes', libelle: 'Cartes FVS', actif: false, active_at: null };
  }

  static async setEnabled(enabled) {
    const result = await query("UPDATE modules_plateforme SET actif = $1, active_at = CASE WHEN $1 THEN COALESCE(active_at, CURRENT_TIMESTAMP) ELSE active_at END WHERE code = 'cartes' RETURNING code, libelle, actif, active_at", [Boolean(enabled)]);
    if (!result.rowCount) throw Object.assign(new Error('Le module Cartes n’est pas installé.'), { status: 500, expose: true });
    return result.rows[0];
  }

  static async assertEnabled() {
    const result = await query("SELECT actif FROM modules_plateforme WHERE code = 'cartes'");
    if (!result.rowCount || !result.rows[0].actif) throw unavailable();
  }

  static async classContext(classId, scope) {
    const siteFilter = scopedWhere(scope, 'ca.site_id', 2);
    const result = await query(`SELECT ca.id, ca.site_id, ca.code_affichage, ca.division_nom,
        a.id AS annee_scolaire_id, a.libelle AS annee_libelle, s.nom AS site_nom,
        n.code AS niveau_code, n.libelle AS niveau_libelle
      FROM classes_annuelles ca
      JOIN annees_scolaires a ON a.id = ca.annee_scolaire_id
      JOIN classes c ON c.id = ca.classe_id
      JOIN niveaux_scolaires n ON n.id = c.niveau_id
      JOIN sites s ON s.id = ca.site_id
      WHERE ca.id = $1 AND ca.actif = true${siteFilter.sql}`, [classId, ...siteFilter.params]);
    return result.rows[0] || null;
  }

  static async studentsForClass(classId, scope) {
    const siteFilter = scopedWhere(scope, 'ca.site_id', 2);
    const result = await query(`SELECT ${CARD_FIELDS}
      FROM classes_annuelles ca
      JOIN affectations_inscription ai ON ai.classe_annuelle_id = ca.id AND ai.active = true
      JOIN inscriptions i ON i.id = ai.inscription_id AND i.statut = 'active'
      JOIN eleves e ON e.id = i.eleve_id
      WHERE ca.id = $1 AND ca.actif = true${siteFilter.sql}
      ORDER BY e.nom, e.prenom`, [classId, ...siteFilter.params]);
    return result.rows;
  }

  static async preview(classId, scope) {
    await this.assertEnabled();
    const [classInfo, students] = await Promise.all([
      this.classContext(classId, scope),
      this.studentsForClass(classId, scope),
    ]);
    if (!classInfo) throw Object.assign(new Error('Classe annuelle introuvable ou non autorisée.'), { status: 404, expose: true });
    return { classInfo, students, totalCards: students.length };
  }

  static async stats(scope) {
    await this.assertEnabled();
    const siteFilter = scopedWhere(scope, 'ca.site_id', 1);
    const result = await query(`SELECT COUNT(DISTINCT ca.id)::int AS total_classes,
        COUNT(DISTINCT e.id)::int AS total_students
      FROM classes_annuelles ca
      JOIN annees_scolaires a ON a.id = ca.annee_scolaire_id AND a.statut = 'active'
      LEFT JOIN affectations_inscription ai ON ai.classe_annuelle_id = ca.id AND ai.active = true
      LEFT JOIN inscriptions i ON i.id = ai.inscription_id AND i.statut = 'active'
      LEFT JOIN eleves e ON e.id = i.eleve_id
      WHERE ca.actif = true${siteFilter.sql}`, siteFilter.params);
    return result.rows[0];
  }
}
