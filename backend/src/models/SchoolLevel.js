import { randomUUID } from 'crypto';
import { query } from '../config/database.js';

const slugify = (value) => value.trim().toLowerCase()
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

export class SchoolLevel {
  static async listCycles() {
    const result = await query('SELECT id, nom, ordre, type_division FROM cycles ORDER BY ordre');
    return result.rows;
  }
  static async list() {
    const result = await query(`SELECT n.id, n.cycle_id, n.code, n.libelle, n.ordre, n.actif, c.nom AS cycle_nom, c.type_division
      FROM niveaux_scolaires n JOIN cycles c ON c.id = n.cycle_id
      WHERE n.actif = true ORDER BY c.ordre, n.ordre`);
    return result.rows;
  }
  static async create({ cycleId, libelle, ordre }) {
    const cleanLibelle = libelle?.trim();
    if (!cleanLibelle) throw Object.assign(new Error('Le libellé du niveau est requis.'), { status: 400, expose: true });
    const cycle = await query('SELECT id FROM cycles WHERE id = $1', [cycleId]);
    if (!cycle.rowCount) throw Object.assign(new Error('Cycle invalide.'), { status: 400, expose: true });
    let code = slugify(cleanLibelle) || randomUUID().slice(0, 8);
    let suffix = 2;
    while (true) {
      const duplicate = await query('SELECT 1 FROM niveaux_scolaires WHERE cycle_id = $1 AND code = $2', [cycleId, code]);
      if (!duplicate.rowCount) break;
      code = `${slugify(cleanLibelle)}-${suffix++}`;
    }
    const finalOrdre = ordre ?? ((await query('SELECT COALESCE(MAX(ordre), 0) + 1 AS next FROM niveaux_scolaires WHERE cycle_id = $1', [cycleId])).rows[0].next);
    const created = await query(`INSERT INTO niveaux_scolaires (cycle_id, code, libelle, ordre) VALUES ($1,$2,$3,$4) RETURNING id, cycle_id, code, libelle, ordre, actif`, [cycleId, code, cleanLibelle, finalOrdre]);
    return created.rows[0];
  }
  static async reorder(cycleId, orderedIds) {
    const client = await query('BEGIN').then(() => null).catch(() => null); // placeholder si pool.connect utilisé ailleurs
    for (let i = 0; i < orderedIds.length; i++) {
      await query('UPDATE niveaux_scolaires SET ordre = $1 WHERE id = $2 AND cycle_id = $3', [i + 1, orderedIds[i], cycleId]);
    }
    return this.list();
  }
  static async deactivate(id) {
    const inUse = await query('SELECT 1 FROM classes WHERE niveau_id = $1', [id]);
    if (inUse.rowCount) throw Object.assign(new Error('Ce niveau est utilisé par des classes existantes, il ne peut pas être désactivé.'), { status: 409, expose: true });
    const result = await query('UPDATE niveaux_scolaires SET actif = false WHERE id = $1 RETURNING id', [id]);
    return result.rows[0] || null;
  }
}