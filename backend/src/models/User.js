import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { query } from '../config/database.js';
import { normalizeUsername } from '../utils/username.js';

export const MANAGEMENT_ROLES = ['directeur', 'secretaire', 'comptable', 'censeur'];
const roleLabel = (role) => ({ directeur: 'Directeur', secretaire: 'Secrétaire', comptable: 'Comptable', censeur: 'Censeur' }[role] || role);

export class User {
  static async createDefaultManagementAccounts({ credentials }) {
    const result = [];
    const site = await query('SELECT id FROM sites WHERE est_principal = true');
    for (const { role, password } of credentials) {
      const passwordHash = await bcrypt.hash(password, 10);
      const nom = roleLabel(role);
      const created = await query(`INSERT INTO users (id, username, password_hash, role, nom, status, password_personalized) VALUES ($1, $2, $3, $4, $5, 'active', false) RETURNING id, username, role, nom, status`, [randomUUID(), role, passwordHash, role, nom]);
      const access = await query(`INSERT INTO acces_utilisateur_sites (user_id, site_id, designation, portee)
        VALUES ($1, $2, $3, $4) RETURNING id`, [created.rows[0].id, role === 'directeur' ? null : site.rows[0]?.id || null, role, role === 'directeur' ? 'etablissement' : 'site']);
      await query(`INSERT INTO acces_utilisateur_profils (acces_id, profil_id)
        SELECT $1, id FROM profils_acces WHERE designation = $2`, [access.rows[0].id, role]);
      result.push(created.rows[0]);
    }
    return result;
  }
  static async findByEmail(email) { const result = await query('SELECT * FROM users WHERE LOWER(email) = LOWER($1)', [email.trim()]); return result.rows[0] || null; }
  static async findByUsername(username) { const result = await query('SELECT * FROM users WHERE LOWER(username) = LOWER($1)', [username]); return result.rows[0] || null; }
  static async findById(id) { const result = await query(`SELECT id, email, role, username, nom, prenom, telephone, status, disabled_at, password_personalized, created_at FROM users WHERE id = $1`, [id]); return result.rows[0] || null; }
  static async permissionsFor(userId) {
    const result = await query(`SELECT DISTINCT pp.permission_code
      FROM acces_utilisateur_sites a
      JOIN acces_utilisateur_profils ap ON ap.acces_id = a.id
      JOIN profils_acces p ON p.id = ap.profil_id AND p.actif = true
      JOIN profil_permissions pp ON pp.profil_id = p.id
      WHERE a.user_id = $1 AND a.actif = true`, [userId]);
    return result.rows.map((row) => row.permission_code);
  }
  static async setProfile(userId, { nom, prenom, email, telephone }) {
    const current = await this.findById(userId);
    if (!current) return null;
    const cleanNom = nom?.trim() || null;
    const cleanPrenom = prenom?.trim() || null;
    let username = current.username;
    if (cleanNom && cleanPrenom) {
      const prefixes = { directeur: 'Dir', secretaire: 'Sec', comptable: 'Compt', censeur: 'Cens' };
      const firstLetter = normalizeUsername(cleanNom).charAt(0).toUpperCase();
      const readablePrenom = cleanPrenom.charAt(0).toUpperCase() + cleanPrenom.slice(1);
      const base = `${prefixes[current.role]}-${firstLetter}${readablePrenom}`;
      username = base;
      let suffix = 2;
      while (true) {
        const duplicate = await query('SELECT 1 FROM users WHERE LOWER(username) = LOWER($1) AND id <> $2', [username, userId]);
        if (!duplicate.rowCount) break;
        username = `${base}${suffix++}`;
      }
    }
    const result = await query(`UPDATE users SET username = $1, nom = $2, prenom = $3, email = $4, telephone = $5, updated_at = CURRENT_TIMESTAMP WHERE id = $6 RETURNING id, email, role, username, nom, prenom, telephone, password_personalized`, [username, cleanNom, cleanPrenom, email?.trim().toLowerCase() || null, telephone?.trim() || null, userId]);
    return result.rows[0];
  }
  static async changePassword(userId, currentPassword, newPassword) {
    const full = await query('SELECT password_hash FROM users WHERE id = $1', [userId]);
    if (!(await this.verifyPassword(currentPassword, full.rows[0]?.password_hash))) return false;
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await query(`UPDATE users SET password_hash = $1, password_personalized = true, updated_at = CURRENT_TIMESTAMP WHERE id = $2`, [passwordHash, userId]);
    return true;
  }
  static async setResetToken(userId, tokenHash, expiresAt) { await query(`UPDATE users SET password_reset_token_hash = $1, password_reset_expires_at = $2 WHERE id = $3`, [tokenHash, expiresAt, userId]); }
  static async resetPassword(tokenHash, password) {
    const passwordHash = await bcrypt.hash(password, 10);
    const result = await query(`UPDATE users SET password_hash = $1, password_personalized = true, password_reset_token_hash = NULL, password_reset_expires_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE password_reset_token_hash = $2 AND password_reset_expires_at > CURRENT_TIMESTAMP RETURNING id`, [passwordHash, tokenHash]);
    return result.rowCount > 0;
  }
  static async verifyPassword(password, passwordHash) { return Boolean(passwordHash) && bcrypt.compare(password, passwordHash); }
  static isManagementRole(role) { return MANAGEMENT_ROLES.includes(role); }
}
