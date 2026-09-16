import { query } from '../config/database.js';

export const accessScopeFor = async (user) => {
  if (user.role === 'directeur') return { allSites: true, siteIds: [] };
  const result = await query(`SELECT site_id FROM acces_utilisateur_sites
    WHERE user_id = $1 AND actif = true AND portee = 'site'`, [user.id]);
  return { allSites: false, siteIds: result.rows.map(({ site_id }) => site_id) };
};

export const resolveScopedSite = async (scope, requestedSiteId = null) => {
  if (scope.allSites) {
    const result = await query(requestedSiteId
      ? 'SELECT id FROM sites WHERE id = $1 AND actif = true'
      : 'SELECT id FROM sites WHERE est_principal = true AND actif = true', requestedSiteId ? [requestedSiteId] : []);
    if (result.rowCount) return result.rows[0].id;
  } else if (requestedSiteId && scope.siteIds.includes(requestedSiteId)) return requestedSiteId;
  else if (!requestedSiteId && scope.siteIds.length === 1) return scope.siteIds[0];
  throw Object.assign(new Error('Site non autorisé ou non précisé.'), { status: 403, expose: true });
};

export const scopedWhere = (scope, column, parameterIndex) => scope.allSites
  ? { sql: '', params: [] }
  : { sql: ` AND ${column} = ANY($${parameterIndex}::uuid[])`, params: [scope.siteIds] };
