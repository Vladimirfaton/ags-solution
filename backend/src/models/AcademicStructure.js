import { query } from '../config/database.js';
import { resolveScopedSite, scopedWhere } from './AccessScope.js';

const normalizeLevel = (value = '') => value.trim().toLowerCase()
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/\s/g, '');

const divisionLabel = (type) => type === 'groupe' ? 'Groupe' : 'Série';

export class AcademicStructure {
  static async context(scope, siteId) {
    const [year, resolvedSiteId] = await Promise.all([
      query("SELECT id, libelle FROM annees_scolaires WHERE statut = 'active'"),
      resolveScopedSite(scope, siteId),
    ]);
    return { year: year.rows[0] || null, site: { id: resolvedSiteId } };
  }
  static async listAnnualClasses(scope) {
    const context = await this.context(scope);
    if (!context.year) return { ...context, classes: [] };
    const establishment = await query('SELECT type FROM etablissement WHERE singleton = true');
    const allowedLevels = establishment.rows[0]?.type === 'primaire' ? ['CI', 'CP', 'CE1', 'CE2', 'CM1', 'CM2'] : ['6e', '5e', '4e', '3e', '2nde', '1ere', 'terminale'];
    const siteFilter = scopedWhere(scope, 'ca.site_id', 3);
    const result = await query(`SELECT ca.id, ca.code_affichage, ca.division_nom, ca.division_type, ca.actif, s.nom AS site_nom, n.ordre, n.libelle AS niveau_libelle, COUNT(ai.id)::int AS effectif FROM classes_annuelles ca JOIN classes c ON c.id = ca.classe_id JOIN niveaux_scolaires n ON n.id = c.niveau_id JOIN sites s ON s.id = ca.site_id LEFT JOIN affectations_inscription ai ON ai.classe_annuelle_id = ca.id AND ai.active = true WHERE ca.annee_scolaire_id = $1 AND n.code = ANY($2::text[])${siteFilter.sql} GROUP BY ca.id, s.nom, n.ordre, n.libelle ORDER BY n.ordre, ca.division_nom`, [context.year.id, allowedLevels, ...siteFilter.params]);
    return { ...context, classes: result.rows };
  }
  static async createAnnualClass({ niveauCode, divisionNom, divisionType, siteId }, scope) {
    const context = await this.context(scope, siteId);
    if (!context.year || !context.site) throw Object.assign(new Error('Configurez une année scolaire active avant les classes.'), { status: 400, expose: true });
    const establishment = await query('SELECT type FROM etablissement WHERE singleton = true');
    const allowedLevels = establishment.rows[0]?.type === 'primaire'
      ? ['CI', 'CP', 'CE1', 'CE2', 'CM1', 'CM2']
      : ['6e', '5e', '4e', '3e', '2nde', '1ere', 'terminale'];
    if (!allowedLevels.includes(niveauCode)) throw Object.assign(new Error('Ce niveau ne correspond pas au type de l’établissement.'), { status: 400, expose: true });
    const niveau = await query('SELECT id, cycle_id, code, libelle, ordre FROM niveaux_scolaires WHERE code = $1', [niveauCode]);
    if (!niveau.rowCount) throw Object.assign(new Error('Niveau de classe invalide.'), { status: 400, expose: true });
    const { id: niveauId, cycle_id: cycleId, libelle, ordre } = niveau.rows[0];
    const cycle = await query('SELECT type_division FROM cycles WHERE id = $1 AND actif = true', [cycleId]);
    if (!cycle.rowCount) throw Object.assign(new Error('Cycle scolaire invalide.'), { status: 400, expose: true });
    const rule = cycle.rows[0].type_division;
    const cleanDivision = divisionNom?.trim();
    const divisionRuleError = rule === 'libre' ? 'groupe ou série' : divisionLabel(rule).toLowerCase();
    if (!cleanDivision || !['groupe', 'serie'].includes(divisionType) || (rule !== 'libre' && divisionType !== rule)) throw Object.assign(new Error(`Pour ${libelle}, indiquez un ${divisionRuleError} non vide.`), { status: 400, expose: true });
    let classe = await query('SELECT id FROM classes WHERE cycle_id = $1 AND niveau_id = $2', [cycleId, niveauId]);
    if (!classe.rowCount) classe = await query('INSERT INTO classes (cycle_id, niveau_id, nom, ordre) VALUES ($1, $2, $3, $4) RETURNING id', [cycleId, niveauId, libelle, ordre]);
    const code = `${libelle}-${cleanDivision.toUpperCase()}`;
    const created = await query(`INSERT INTO classes_annuelles (annee_scolaire_id, site_id, classe_id, division_nom, division_type, code_affichage) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, code_affichage, division_nom, division_type, actif`, [context.year.id, context.site.id, classe.rows[0].id, cleanDivision, divisionType, code]);
    return created.rows[0];
  }
}
