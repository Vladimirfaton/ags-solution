import { query } from '../config/database.js';
import { scopedWhere } from './AccessScope.js';

const CARD_FIELDS = `e.id, e.matricule, e.nom, e.prenom, e.sexe,
  TO_CHAR(e.date_naissance, 'YYYY-MM-DD') AS date_naissance,
  e.lieu_naissance, e.nationalite, e.telephone, e.photo_path`;

const unavailable = () => Object.assign(new Error('Le service Cartes FVS n’est pas activé pour cet établissement.'), { status: 403, expose: true });

export class CardService {
  static async status(scope = null) {
    const result = await query("SELECT code, libelle, actif, admin_actif, active_at FROM modules_plateforme WHERE code = 'cartes'");
    const service = result.rows[0] || { code: 'cartes', libelle: 'Cartes FVS', actif: false, admin_actif: false, active_at: null };
    const filter = scope && !scope.allSites ? ' AND s.id = ANY($1::uuid[])' : '';
    const sites = await query(`SELECT s.id, s.nom, s.est_principal, scs.confirme_at FROM sites s LEFT JOIN services_cartes_sites scs ON scs.site_id = s.id WHERE s.actif = true AND s.nom NOT LIKE 'TEST-INT-%'${filter} ORDER BY s.est_principal DESC, s.nom`, scope && !scope.allSites ? [scope.siteIds] : []);
    const adminActif = Boolean(service.admin_actif);
    return { ...service, admin_actif: adminActif, actif: adminActif && sites.rows.some((site) => site.confirme_at), sites: sites.rows };
  }

  static async setEnabled(enabled) {
    const result = await query("UPDATE modules_plateforme SET admin_actif = $1, actif = $1, active_at = CASE WHEN $1 THEN COALESCE(active_at, CURRENT_TIMESTAMP) ELSE active_at END WHERE code = 'cartes' RETURNING code, libelle, actif, admin_actif, active_at", [Boolean(enabled)]);
    if (!result.rowCount) throw Object.assign(new Error('Le module Cartes n’est pas installé.'), { status: 500, expose: true });
    return result.rows[0];
  }

  static async setAdminEnabled(enabled) { return this.setEnabled(enabled); }

  static async confirmSites(siteIds, userId, scope = null) {
    const ids = [...new Set((siteIds || []).filter(Boolean))];
    const sites = await query("SELECT id FROM sites WHERE actif = true AND nom NOT LIKE 'TEST-INT-%' ORDER BY est_principal DESC, nom");
    if (!sites.rowCount) throw Object.assign(new Error('Aucun site configuré.'), { status: 400, expose: true });
    const selected = ids.length ? ids : (sites.rowCount === 1 ? [sites.rows[0].id] : []);
    if (!selected.length) throw Object.assign(new Error('Sélectionnez au moins un site.'), { status: 400, expose: true });
    const allowed = new Set(sites.rows.map((site) => site.id));
    if (selected.some((id) => !allowed.has(id))) throw Object.assign(new Error('Un site sélectionné est invalide.'), { status: 400, expose: true });
    if (scope && !scope.allSites && selected.some((id) => !scope.siteIds.includes(id))) {
      throw Object.assign(new Error('Un site sélectionné n’est pas autorisé.'), { status: 403, expose: true });
    }
    await this.assertAdminEnabled();
    for (const siteId of selected) {
      await query('INSERT INTO services_cartes_sites (site_id, confirme_par) VALUES ($1, $2) ON CONFLICT (site_id) DO NOTHING', [siteId, userId]);
    }
    return this.status(scope);
  }

  static async activateSite(siteId, userId, scope) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(siteId || '')) {
      throw Object.assign(new Error('Identifiant de site invalide.'), { status: 400, expose: true });
    }
    await this.assertAdminEnabled();
    if (scope && !scope.allSites && !scope.siteIds.includes(siteId)) {
      throw Object.assign(new Error('Site non autorisé.'), { status: 403, expose: true });
    }
    const site = await query("SELECT id FROM sites WHERE id = $1 AND actif = true AND nom NOT LIKE 'TEST-INT-%'", [siteId]);
    if (!site.rowCount) throw Object.assign(new Error('Site introuvable ou inactif.'), { status: 404, expose: true });
    await query('INSERT INTO services_cartes_sites (site_id, confirme_par) VALUES ($1, $2) ON CONFLICT (site_id) DO NOTHING', [siteId, userId]);
    return this.status(scope);
  }

  static async assertAdminEnabled() {
    const result = await query("SELECT admin_actif FROM modules_plateforme WHERE code = 'cartes'");
    if (!result.rowCount || !result.rows[0].admin_actif) throw unavailable();
  }

  static async assertEnabled() {
    const result = await query("SELECT admin_actif FROM modules_plateforme WHERE code = 'cartes'");
    if (!result.rowCount || !result.rows[0].admin_actif) throw unavailable();
  }
  static async effectiveScope(scope) {
    const confirmed = await query('SELECT site_id FROM services_cartes_sites');
    const confirmedIds = confirmed.rows.map(({ site_id }) => site_id);
    const siteIds = scope && !scope.allSites
      ? confirmedIds.filter((id) => scope.siteIds.includes(id))
      : confirmedIds;
    return { allSites: false, siteIds };
  }

  static async listManagementClasses(scope) {
    await this.assertEnabled();
    const siteFilter = scopedWhere(await this.effectiveScope(scope), 'ca.site_id', 1);
    const result = await query(`SELECT ca.id, ca.code_affichage, ca.site_id, s.nom AS site_nom, a.libelle AS annee_libelle
      FROM classes_annuelles ca
      JOIN annees_scolaires a ON a.id = ca.annee_scolaire_id AND a.statut = 'active'
      JOIN sites s ON s.id = ca.site_id
      JOIN services_cartes_sites scs ON scs.site_id = ca.site_id
      WHERE ca.actif = true${siteFilter.sql}
      ORDER BY s.nom, ca.code_affichage`, siteFilter.params);
    return result.rows;
  }

  static async recordDraft(classId) {
    await this.assertEnabled();
    const classInfo = await this.classContext(classId, null);
    if (!classInfo) throw Object.assign(new Error('Classe annuelle introuvable ou non autorisée.'), { status: 404, expose: true });
    const students = await query(`SELECT COUNT(DISTINCT i.eleve_id)::int AS total
      FROM affectations_inscription ai
      JOIN inscriptions i ON i.id = ai.inscription_id AND i.statut = 'active'
      WHERE ai.classe_annuelle_id = $1 AND ai.active = true`, [classId]);
    const name = `Brouillon ${classInfo.code_affichage} · ${classInfo.annee_libelle}`;
    const result = await query(`INSERT INTO cartes_brouillons (annee_scolaire_id, site_id, classe_annuelle_id, nom, total_cartes, statut)
      VALUES ($1, $2, $3, $4, $5, 'pret') RETURNING id, nom, total_cartes, statut, created_at`,
      [classInfo.annee_scolaire_id, classInfo.site_id, classId, name, students.rows[0].total]);
    return result.rows[0];
  }

  static async getManagementClassPreview(classId, scope) {
    const preview = await this.preview(classId, scope);
    return { ...preview, etablissement: await this.identity() };
  }
    static async identity() {
    const result = await query('SELECT id, nom, slogan, signature_path FROM etablissement WHERE singleton = true');
    return result.rows[0] || null;
  }

  static async updateSlogan(slogan) {
    const value = String(slogan || '').trim().slice(0, 150) || null;
    const result = await query('UPDATE etablissement SET slogan = $1 WHERE singleton = true RETURNING id, nom, slogan, signature_path', [value]);
    return result.rows[0] || null;
  }

  static async setSignature(url) {
    const previous = (await this.identity())?.signature_path || null;
    const result = await query('UPDATE etablissement SET signature_path = $1 WHERE singleton = true RETURNING id, nom, slogan, signature_path', [url]);
    return { identity: result.rows[0] || null, previous };
  }
    static async assertStudentAccess(studentId) {
    await this.assertEnabled();
    const result = await query(`SELECT 1 FROM eleves e
      JOIN inscriptions i ON i.eleve_id = e.id AND i.statut = 'active'
      JOIN affectations_inscription ai ON ai.inscription_id = i.id AND ai.active = true
      JOIN classes_annuelles ca ON ca.id = ai.classe_annuelle_id AND ca.actif = true
      JOIN services_cartes_sites scs ON scs.site_id = ca.site_id
      WHERE e.id = $1 LIMIT 1`, [studentId]);
    if (!result.rowCount) throw Object.assign(new Error('Élève introuvable ou site non confirmé pour les cartes.'), { status: 404, expose: true });
  }

  static async updateStudentCard(studentId, data) {
    await this.assertStudentAccess(studentId);
    const nom = String(data.nom || '').trim();
    const prenom = String(data.prenom || '').trim();
    if (!nom || !prenom) throw Object.assign(new Error('Le nom et le prénom sont requis.'), { status: 400, expose: true });
    const birth = data.dateNaissance ? String(data.dateNaissance).slice(0, 10) : null;
    if (birth && Number.isNaN(Date.parse(birth))) throw Object.assign(new Error('Date de naissance invalide.'), { status: 400, expose: true });
    const sexe = ['M', 'F'].includes(data.sexe) ? data.sexe : null;
    const clean = (value) => String(value || '').trim() || null;
    const result = await query(`UPDATE eleves SET nom = $2, prenom = $3, sexe = $4, date_naissance = $5,
        lieu_naissance = $6, nationalite = $7, telephone = $8
      WHERE id = $1 RETURNING id, matricule`,
      [studentId, nom, prenom, sexe, birth, clean(data.lieuNaissance), clean(data.nationalite), clean(data.telephone)]);
    return result.rows[0];
  }

  static async setStudentPhoto(studentId, url) {
    const previous = await query('SELECT photo_path FROM eleves WHERE id = $1', [studentId]);
    await query('UPDATE eleves SET photo_path = $2 WHERE id = $1', [studentId, url]);
    return { previous: previous.rows[0]?.photo_path || null };
  }
  static async classContext(classId, scope) {
    const siteFilter = scopedWhere(await this.effectiveScope(scope), 'ca.site_id', 2);
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

  static async listClassesForAdmin() {
    const result = await query(`SELECT ca.id, ca.site_id, ca.code_affichage, s.nom AS site_nom, a.libelle AS annee_libelle,
        COUNT(DISTINCT i.eleve_id)::int AS effectif
      FROM classes_annuelles ca
      JOIN sites s ON s.id = ca.site_id
      JOIN annees_scolaires a ON a.id = ca.annee_scolaire_id
      JOIN services_cartes_sites scs ON scs.site_id = ca.site_id
      LEFT JOIN affectations_inscription ai ON ai.classe_annuelle_id = ca.id AND ai.active = true
      LEFT JOIN inscriptions i ON i.id = ai.inscription_id AND i.statut = 'active'
      WHERE ca.actif = true AND a.statut = 'active'
      GROUP BY ca.id, s.nom, a.libelle
      ORDER BY s.nom, ca.code_affichage`);
    return result.rows;
  }

  static async studentsForClass(classId, scope) {
    const siteFilter = scopedWhere(await this.effectiveScope(scope), 'ca.site_id', 2);
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
    const siteFilter = scopedWhere(await this.effectiveScope(scope), 'ca.site_id', 1);
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
