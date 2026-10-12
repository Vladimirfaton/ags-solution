import { query } from '../config/database.js';
import logger from '../config/logger.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const escapeHtml = (value) => (value ?? '').toString()
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const schoolYear = (date = new Date()) => {
  const year = date.getFullYear();
  return date.getMonth() + 1 >= 9 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
};

const layout = ({ title, body }) => `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
<style>
  * { box-sizing: border-box; }
  body { margin: 0; padding: 32px 20px; background: #f7faf8; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, Helvetica, sans-serif; color: #1e293b; display: flex; justify-content: center; }
  .card { width: 100%; max-width: 420px; background: #fff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 28px 24px; text-align: center; }
  .nom { font-size: 20px; font-weight: 700; color: #0f172a; margin: 0 0 4px; line-height: 1.25; }
  .loc { font-size: 13px; color: #64748b; margin: 0 0 20px; }
  .titre { font-size: 13px; font-weight: 700; letter-spacing: .02em; color: #059669; text-transform: uppercase; margin: 0 0 20px; }
  .message { font-size: 15px; line-height: 1.55; color: #334155; margin: 0 0 18px; }
  .contact { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; padding: 14px 16px; margin: 0 0 20px; }
  .contact-label { font-size: 11px; text-transform: uppercase; letter-spacing: .04em; color: #059669; font-weight: 700; margin: 0 0 4px; }
  .contact-value { font-size: 17px; font-weight: 700; color: #0f172a; }
  .bande { display: flex; height: 5px; border-radius: 3px; overflow: hidden; margin: 0 0 16px; }
  .bande div { flex: 1; }
  .footer { font-size: 11px; color: #94a3b8; }
</style>
</head>
<body>
  <div class="card">
    ${body}
    <div class="bande"><div style="background:#00873E"></div><div style="background:#FCD900"></div><div style="background:#E31C24"></div></div>
    <div class="footer">Réalisé par FVS</div>
  </div>
</body>
</html>`;

const notFound = () => layout({
  title: 'Carte introuvable',
  body: '<p class="nom">Carte non reconnue</p><p class="message">Cette carte ne correspond à aucun établissement enregistré sur la plateforme FVS.</p>',
});

const failure = () => layout({
  title: 'Erreur',
  body: '<p class="nom">Page indisponible</p><p class="message">Une erreur est survenue. Merci de réessayer plus tard.</p>',
});

export const getEstablishmentCardInfoPage = async (req, res) => {
  res.set('Content-Type', 'text/html; charset=utf-8');
  try {
    const { id } = req.params;
    if (!UUID.test(id)) return res.status(404).send(notFound());
    const result = await query('SELECT nom, commune, departement, telephone FROM etablissement WHERE id = $1', [id]);
    if (!result.rowCount) return res.status(404).send(notFound());
    const row = result.rows[0];
    const nom = escapeHtml(row.nom || 'Établissement');
    const loc = escapeHtml([row.commune, row.departement].filter(Boolean).join(', '));
    const phone = row.telephone ? escapeHtml(row.telephone) : 'Voir avec l’établissement';
    return res.send(layout({
      title: `${nom} — Carte d'identité scolaire`,
      body: `<p class="nom">${nom}</p>
    ${loc ? `<p class="loc">${loc}</p>` : ''}
    <p class="titre">Carte d'identité scolaire — ${schoolYear()}</p>
    <p class="message">Le titulaire de cette carte est élève au ${nom}.</p>
    <p class="message" style="margin-bottom:8px;">En cas de perte, merci de bien vouloir contacter :</p>
    <div class="contact"><div class="contact-label">Contact de l'établissement</div><div class="contact-value">${phone}</div></div>`,
    }));
  } catch (error) {
    logger.error(`Page publique carte-info: ${error.message}`);
    return res.status(500).send(failure());
  }
};