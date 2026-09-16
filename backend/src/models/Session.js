import { query } from '../config/database.js';

const source = (accountType) => accountType === 'admin'
  ? { table: 'sessions_admin', owner: 'admin_id' }
  : { table: 'sessions_gestion', owner: 'user_id' };

export class Session {
  static async create({ accountType, accountId, tokenId, deviceLabel, expiresAt, maxSessions }) {
    const { table, owner } = source(accountType);
    await query(`UPDATE ${table} SET revoked_at = CURRENT_TIMESTAMP, revoke_reason = 'nouvelle_connexion' WHERE id IN (SELECT id FROM ${table} WHERE ${owner} = $1 AND revoked_at IS NULL AND expires_at > CURRENT_TIMESTAMP ORDER BY created_at DESC OFFSET $2)`, [accountId, Math.max(0, maxSessions - 1)]);
    await query(`INSERT INTO ${table} (${owner}, token_id, device_label, expires_at) VALUES ($1, $2, $3, $4)`, [accountId, tokenId, deviceLabel || null, expiresAt]);
  }
  static async isActive(accountType, accountId, tokenId) {
    const { table, owner } = source(accountType);
    const result = await query(`SELECT 1 FROM ${table} WHERE ${owner} = $1 AND token_id = $2 AND revoked_at IS NULL AND expires_at > CURRENT_TIMESTAMP`, [accountId, tokenId]);
    return result.rowCount > 0;
  }
  static async touch(accountType, accountId, tokenId) {
    const { table, owner } = source(accountType);
    await query(`UPDATE ${table} SET last_activity_at = CURRENT_TIMESTAMP WHERE ${owner} = $1 AND token_id = $2 AND revoked_at IS NULL`, [accountId, tokenId]);
  }
}
