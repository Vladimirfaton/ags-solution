import { query } from '../config/database.js';
import logger from '../config/logger.js';
import { CardService } from './CardService.js';
import { sendBrouillonReadyEmail, sendCartesReadyEmail } from '../utils/email.js';

const fail = (message, status) => Object.assign(new Error(message), { status, expose: true });
const DB_TYPES = { brouillon: 'brouillon_pret', cartes: 'cartes_pretes' };

export class CardNotification {
  static async send({ type, classId, siteId, datePassage, adminId }) {
    if (!DB_TYPES[type]) throw fail('Type de notification invalide.', 400);
    let passage = null;
    if (type === 'cartes') {
      passage = datePassage ? new Date(datePassage) : null;
      if (!passage || Number.isNaN(passage.getTime())) throw fail('Date de passage requise.', 400);
    }
    await CardService.assertEnabled();

    let site;
    let yearId;
    let classCode = null;
    if (classId) {
      const info = await CardService.classContext(classId, null);
      if (!info) throw fail('Classe annuelle introuvable ou site non confirmé.', 404);
      site = { id: info.site_id, nom: info.site_nom };
      yearId = info.annee_scolaire_id;
      classCode = info.code_affichage;
    } else {
      if (!siteId) throw fail('Site requis.', 400);
      const found = await query(`SELECT s.id, s.nom FROM sites s
        JOIN services_cartes_sites scs ON scs.site_id = s.id WHERE s.id = $1`, [siteId]);
      if (!found.rowCount) throw fail('Site introuvable ou non confirmé pour les cartes.', 404);
      site = found.rows[0];
      const year = await query("SELECT id FROM annees_scolaires WHERE statut = 'active'");
      if (!year.rowCount) throw fail('Aucune année scolaire active.', 400);
      yearId = year.rows[0].id;
    }

    const recipients = await query(`SELECT DISTINCT u.id, u.email, u.role
      FROM users u
      JOIN acces_utilisateur_sites a ON a.user_id = u.id AND a.actif = true
      WHERE u.status = 'active' AND u.disabled_at IS NULL
        AND u.role IN ('directeur', 'secretaire')
        AND u.email IS NOT NULL AND btrim(u.email) <> ''
        AND (a.portee = 'etablissement' OR a.site_id = $1)`, [site.id]);
    if (!recipients.rowCount) throw fail('Aucun compte directeur ou secrétaire actif avec email pour ce site.', 400);

    const loginUrl = `${(process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/+$/, '')}/gestion`;
    const results = await Promise.all(recipients.rows.map(async (account) => {
      try {
        if (type === 'cartes') {
          await sendCartesReadyEmail(account.email, { role: account.role, collegeName: site.nom, classeCode: classCode, datePassage: passage.toISOString(), loginUrl });
        } else {
          await sendBrouillonReadyEmail(account.email, { role: account.role, collegeName: site.nom, classeCode: classCode, loginUrl });
        }
        return { email: account.email, role: account.role, sent: true };
      } catch (error) {
        logger.error(`Notification cartes (${type}) échouée pour ${account.email}: ${error.message}`);
        return { email: account.email, role: account.role, sent: false };
      }
    }));

    const sent = results.filter((item) => item.sent).length;
    if (!sent) throw fail('Aucun email n’a pu être envoyé.', 502);

    await query(`INSERT INTO cartes_notifications (annee_scolaire_id, site_id, classe_annuelle_id, type, date_passage, envoye_par, emails_sent)
      VALUES ($1, $2, $3, $4, $5, $6, $7)`, [yearId, site.id, classId || null, DB_TYPES[type], passage, adminId, sent]);

    return { sent, failed: results.filter((item) => !item.sent), siteNom: site.nom, classeCode: classCode, type, datePassage: passage };
  }

  static async list(siteId = null) {
    const result = await query(`SELECT n.id, n.type, n.site_id, s.nom AS site_nom, n.classe_annuelle_id,
        ca.code_affichage AS classe_code, n.date_passage, n.emails_sent AS emails_envoyes, n.sent_at
      FROM cartes_notifications n
      JOIN sites s ON s.id = n.site_id
      LEFT JOIN classes_annuelles ca ON ca.id = n.classe_annuelle_id
      WHERE ($1::uuid IS NULL OR n.site_id = $1)
      ORDER BY n.sent_at DESC LIMIT 50`, [siteId]);
    return result.rows;
  }
}