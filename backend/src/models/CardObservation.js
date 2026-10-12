import { query } from '../config/database.js';
import { CardService } from './CardService.js';

const DELETE_DELAY_MS = 30 * 60 * 1000;
const fail = (message, status) => Object.assign(new Error(message), { status, expose: true });

const BASE = `SELECT o.id, o.classe_annuelle_id, o.eleve_id, o.auteur_id, o.auteur_role, o.contenu, o.lu_par_admin, o.created_at,
    u.nom AS auteur_nom, u.prenom AS auteur_prenom,
    e.matricule AS eleve_matricule, e.nom AS eleve_nom, e.prenom AS eleve_prenom
  FROM cartes_observations o
  LEFT JOIN users u ON u.id = o.auteur_id
  LEFT JOIN eleves e ON e.id = o.eleve_id`;

export class CardObservation {
  static async assertClass(classId, scope) {
    await CardService.assertEnabled();
    const info = await CardService.classContext(classId, scope);
    if (!info) throw fail('Classe annuelle introuvable ou non autorisée.', 404);
    return info;
  }

  static async findById(id) {
    const result = await query(`${BASE} WHERE o.id = $1`, [id]);
    return result.rows[0] || null;
  }

  static async create({ classId, studentId, content, author, scope }) {
    const text = String(content || '').trim();
    if (!text) throw fail('Le contenu est requis.', 400);
    await this.assertClass(classId, scope);
    if (studentId) {
      const member = await query(`SELECT 1 FROM affectations_inscription ai
        JOIN inscriptions i ON i.id = ai.inscription_id AND i.statut = 'active'
        WHERE ai.classe_annuelle_id = $1 AND ai.active = true AND i.eleve_id = $2`, [classId, studentId]);
      if (!member.rowCount) throw fail('Cet élève n’est pas dans cette classe.', 400);
    }
    const isAdmin = author.accountType === 'admin';
    const result = await query(`INSERT INTO cartes_observations (classe_annuelle_id, eleve_id, auteur_id, auteur_role, contenu, lu_par_admin)
      VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [classId, studentId || null, isAdmin ? null : author.id, isAdmin ? 'admin' : author.role, text, isAdmin]);
    return this.findById(result.rows[0].id);
  }

  static async listByClass(classId, scope) {
    await this.assertClass(classId, scope);
    const result = await query(`${BASE} WHERE o.classe_annuelle_id = $1 ORDER BY o.created_at DESC`, [classId]);
    return result.rows;
  }

  static async listForManagement(scope) {
    await CardService.assertEnabled();
    const effective = await CardService.effectiveScope(scope);
    const result = await query(`SELECT o.id, o.classe_annuelle_id, o.eleve_id, o.auteur_role, o.contenu, o.created_at,
        u.nom AS auteur_nom, u.prenom AS auteur_prenom,
        ca.code_affichage AS classe_code, s.nom AS site_nom,
        e.matricule AS eleve_matricule, e.nom AS eleve_nom, e.prenom AS eleve_prenom
      FROM cartes_observations o
      JOIN classes_annuelles ca ON ca.id = o.classe_annuelle_id
      JOIN sites s ON s.id = ca.site_id
      JOIN services_cartes_sites scs ON scs.site_id = ca.site_id
      LEFT JOIN users u ON u.id = o.auteur_id
      LEFT JOIN eleves e ON e.id = o.eleve_id
      WHERE ca.site_id = ANY($1::uuid[])
      ORDER BY o.created_at DESC`, [effective.siteIds]);
    return result.rows;
  }

  static async listUnread(limit = 20) {
    const result = await query(`SELECT o.id, o.contenu, o.auteur_role, o.created_at, o.classe_annuelle_id,
        u.nom AS auteur_nom, u.prenom AS auteur_prenom,
        ca.code_affichage AS classe_code, s.nom AS site_nom
      FROM cartes_observations o
      JOIN classes_annuelles ca ON ca.id = o.classe_annuelle_id
      JOIN sites s ON s.id = ca.site_id
      LEFT JOIN users u ON u.id = o.auteur_id
      WHERE o.lu_par_admin = false
      ORDER BY o.created_at DESC LIMIT $1`, [limit]);
    return result.rows;
  }

  static async countUnread() {
    const result = await query('SELECT COUNT(*)::int AS count FROM cartes_observations WHERE lu_par_admin = false');
    return result.rows[0].count;
  }

  static async markAllRead() {
    const result = await query('UPDATE cartes_observations SET lu_par_admin = true WHERE lu_par_admin = false');
    return result.rowCount;
  }

  static async remove(id, actor, scope) {
    const observation = await this.findById(id);
    if (!observation) throw fail('Observation introuvable.', 404);
    if (actor.accountType !== 'admin') {
      await this.assertClass(observation.classe_annuelle_id, scope);
      if (observation.auteur_id !== actor.id) throw fail('Vous ne pouvez supprimer que vos propres observations.', 403);
      if (Date.now() - new Date(observation.created_at).getTime() > DELETE_DELAY_MS) throw fail('Délai de suppression dépassé (30 minutes après création).', 403);
    }
    await query('DELETE FROM cartes_observations WHERE id = $1', [id]);
    return true;
  }
}