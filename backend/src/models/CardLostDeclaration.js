import { query } from '../config/database.js';
import logger from '../config/logger.js';
import { CardService } from './CardService.js';
import { sendSimpleEmail } from '../utils/email.js';

const fail = (message, status) => Object.assign(new Error(message), { status, expose: true });
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class CardLostDeclaration {
  static async list(scope) {
    await CardService.assertEnabled();
    const effective = await CardService.effectiveScope(scope);
    const result = await query(`SELECT d.id, d.site_id, d.classe_annuelle_id, d.eleve_id, d.matricule, d.nom_eleve, d.prenom_eleve,
        d.details, d.lu_par_admin, d.created_at, ca.code_affichage AS classe, s.nom AS site_nom,
        u.nom AS auteur_nom, u.prenom AS auteur_prenom
      FROM cartes_declarations_perte d
      JOIN sites s ON s.id = d.site_id
      LEFT JOIN classes_annuelles ca ON ca.id = d.classe_annuelle_id
      JOIN services_cartes_sites scs ON scs.site_id = d.site_id
      LEFT JOIN users u ON u.id = d.declare_par
      WHERE d.site_id = ANY($1::uuid[])
      ORDER BY d.created_at DESC`, [effective.siteIds]);
    return result.rows;
  }

  static async create(data = {}, actor, scope) {
    await CardService.assertEnabled();
    const siteId = String(data.siteId || '');
    const classId = String(data.classeAnnuelleId || '');
    const studentId = String(data.eleveId || '');
    if (!UUID_PATTERN.test(siteId)) throw fail('Sélectionnez un site valide.', 400);
    const effective = await CardService.effectiveScope(scope);
    if (!effective.siteIds.includes(siteId)) throw fail('Site non autorisé ou non activé pour les cartes.', 403);
    const details = String(data.details || '').trim() || null;
    if (!UUID_PATTERN.test(classId) || !UUID_PATTERN.test(studentId)) throw fail('Sélectionnez une classe et un élève.', 400);
    if (details?.length > 2000) throw fail('Les précisions ne peuvent pas dépasser 2 000 caractères.', 400);

    const student = await query(`SELECT e.id, e.matricule, e.nom, e.prenom, ca.site_id, ca.id AS classe_annuelle_id,
        ca.code_affichage AS classe
      FROM affectations_inscription ai
      JOIN inscriptions i ON i.id = ai.inscription_id AND i.statut = 'active'
      JOIN eleves e ON e.id = i.eleve_id
      JOIN classes_annuelles ca ON ca.id = ai.classe_annuelle_id AND ca.actif = true
      JOIN services_cartes_sites scs ON scs.site_id = ca.site_id
      WHERE ai.active = true AND e.id = $1 AND ca.id = $2 AND ca.site_id = $3`, [studentId, classId, siteId]);
    if (!student.rowCount) throw fail('Élève introuvable dans cette classe ou site non activé.', 404);

    const result = await query(`INSERT INTO cartes_declarations_perte
        (site_id, classe_annuelle_id, eleve_id, matricule, nom_eleve, prenom_eleve, details, declare_par)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id, site_id, classe_annuelle_id, eleve_id, matricule, nom_eleve, prenom_eleve, details, lu_par_admin, created_at`,
    [siteId, classId, studentId, student.rows[0].matricule, student.rows[0].nom, student.rows[0].prenom, details, actor.id]);
    const declaration = { ...result.rows[0], site_nom: (await query('SELECT nom FROM sites WHERE id = $1', [siteId])).rows[0].nom, classe: student.rows[0].classe };

    const admins = await query("SELECT email FROM admins WHERE status = 'active' AND email IS NOT NULL AND btrim(email) <> ''");
    const escaped = (value) => String(value || '').replace(/[&<>"']/g, (character) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    })[character]);
    const subject = `Carte perdue déclarée — ${student.rows[0].prenom} ${student.rows[0].nom}`;
    const html = `<p>Une déclaration de carte perdue a été enregistrée.</p>
      <p>Site : ${escaped(declaration.site_nom)}<br>Classe : ${escaped(declaration.classe)}<br>
      Élève : ${escaped(student.rows[0].prenom)} ${escaped(student.rows[0].nom)} (${escaped(student.rows[0].matricule)})</p>
      ${details ? `<p>Précisions : ${escaped(details)}</p>` : ''}`;
    const mailResults = await Promise.all(admins.rows.map(async ({ email }) => {
      try { await sendSimpleEmail(email, subject, html); return true; }
      catch (error) { logger.error(`Email de déclaration de carte perdue à ${email} échoué: ${error.message}`); return false; }
    }));
    if (!mailResults.some(Boolean)) throw Object.assign(new Error('Déclaration enregistrée, mais aucun email n’a pu être envoyé à l’administration FVS.'), { status: 502, expose: true });
    return declaration;
  }

  static async listUnread(limit = 20) {
    const result = await query(`SELECT d.id, d.matricule, d.nom_eleve, d.prenom_eleve, d.details, d.created_at,
        ca.code_affichage AS classe, s.nom AS site_nom
      FROM cartes_declarations_perte d
      LEFT JOIN classes_annuelles ca ON ca.id = d.classe_annuelle_id
      JOIN sites s ON s.id = d.site_id
      WHERE d.lu_par_admin = false
      ORDER BY d.created_at DESC LIMIT $1`, [limit]);
    return result.rows;
  }

  static async markAllRead() {
    const result = await query('UPDATE cartes_declarations_perte SET lu_par_admin = true WHERE lu_par_admin = false');
    return result.rowCount;
  }
}
