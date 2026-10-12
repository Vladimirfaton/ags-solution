import { query } from '../config/database.js';
import { CardService } from './CardService.js';

export class CardDraft {
  static async list(scope) {
    await CardService.assertEnabled();
    const effective = await CardService.effectiveScope(scope);
    const result = await query(`SELECT d.id, d.nom, d.total_cartes, d.statut, d.created_at,
        d.classe_annuelle_id, ca.code_affichage AS classe_code, s.nom AS site_nom, a.libelle AS annee_libelle
      FROM cartes_brouillons d
      JOIN classes_annuelles ca ON ca.id = d.classe_annuelle_id
      JOIN sites s ON s.id = d.site_id
      JOIN annees_scolaires a ON a.id = d.annee_scolaire_id
      JOIN services_cartes_sites scs ON scs.site_id = d.site_id
      WHERE d.site_id = ANY($1::uuid[])
      ORDER BY d.created_at DESC`, [effective.siteIds]);
    return result.rows;
  }

  static async findForManagement(id, scope) {
    await CardService.assertEnabled();
    const effective = await CardService.effectiveScope(scope);
    const result = await query(`SELECT d.id, d.nom, d.total_cartes, d.statut, d.created_at,
        d.classe_annuelle_id, ca.code_affichage AS classe_code, s.nom AS site_nom, a.libelle AS annee_libelle
      FROM cartes_brouillons d
      JOIN classes_annuelles ca ON ca.id = d.classe_annuelle_id
      JOIN sites s ON s.id = d.site_id
      JOIN annees_scolaires a ON a.id = d.annee_scolaire_id
      JOIN services_cartes_sites scs ON scs.site_id = d.site_id
      WHERE d.id = $1 AND d.site_id = ANY($2::uuid[])`, [id, effective.siteIds]);
    if (!result.rowCount) throw Object.assign(new Error('Brouillon introuvable ou non autorisé.'), { status: 404, expose: true });
    const preview = await CardService.getManagementClassPreview(result.rows[0].classe_annuelle_id, scope);
    return { draft: result.rows[0], ...preview };
  }
}
