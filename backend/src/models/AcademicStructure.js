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
    const siteFilter = scopedWhere(scope, 'ca.site_id', 2);
    const result = await query(`SELECT ca.id, ca.code_affichage, ca.division_nom, ca.division_type, ca.actif, s.nom AS site_nom, n.ordre, COUNT(ai.id)::int AS effectif FROM classes_annuelles ca JOIN classes c ON c.id = ca.classe_id JOIN niveaux_scolaires n ON n.code = c.niveau_code JOIN sites s ON s.id = ca.site_id LEFT JOIN affectations_inscription ai ON ai.classe_annuelle_id = ca.id AND ai.active = true WHERE ca.annee_scolaire_id = $1${siteFilter.sql} GROUP BY ca.id, s.nom, n.ordre ORDER BY n.ordre, ca.division_nom`, [context.year.id, ...siteFilter.params]);
    return { ...context, classes: result.rows };
  }
  static async createAnnualClass({ niveauCode, divisionNom, divisionType, siteId }, scope) {
    const context = await this.context(scope, siteId);
    if (!context.year || !context.site) throw Object.assign(new Error('Configurez une année scolaire active avant les classes.'), { status: 400, expose: true });
    const niveau = await query('SELECT code, libelle, ordre, regle_division FROM niveaux_scolaires WHERE code = $1', [niveauCode]);
    if (!niveau.rowCount) throw Object.assign(new Error('Niveau de classe invalide.'), { status: 400, expose: true });
    const { libelle, ordre, regle_division: rule } = niveau.rows[0];
    const cleanDivision = divisionNom?.trim();
    if (!cleanDivision || !['groupe', 'serie'].includes(divisionType) || (rule !== 'groupe_ou_serie' && divisionType !== rule)) throw Object.assign(new Error(`Pour ${libelle}, indiquez un ${rule === 'groupe_ou_serie' ? 'groupe ou une série' : divisionLabel(rule).toLowerCase()} non vide.`), { status: 400, expose: true });
    let cycle = await query("SELECT id FROM cycles WHERE nom = 'Cycle général'");
    if (!cycle.rowCount) cycle = await query("INSERT INTO cycles (nom, ordre, type_division) VALUES ('Cycle général', 1, 'libre') RETURNING id");
    let classe = await query('SELECT id FROM classes WHERE cycle_id = $1 AND niveau_code = $2', [cycle.rows[0].id, niveauCode]);
    if (!classe.rowCount) classe = await query('INSERT INTO classes (cycle_id, nom, ordre, niveau_code) VALUES ($1, $2, $3, $4) RETURNING id', [cycle.rows[0].id, libelle, ordre, niveauCode]);
    const code = `${libelle}-${divisionLabel(divisionType)} ${cleanDivision}`;
    const created = await query(`INSERT INTO classes_annuelles (annee_scolaire_id, site_id, classe_id, division_nom, division_type, code_affichage) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, code_affichage, division_nom, division_type, actif`, [context.year.id, context.site.id, classe.rows[0].id, cleanDivision, divisionType, code]);
    return created.rows[0];
  }
}
