import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { query } from '../config/database.js';

export class Admin {
  static async count() { const result = await query('SELECT COUNT(*)::int AS count FROM admins'); return result.rows[0].count; }
  static async create(email, password) {
    const passwordHash = await bcrypt.hash(password, 10);
    const result = await query(`INSERT INTO admins (id, email, password_hash) VALUES ($1, $2, $3) RETURNING id, email, status, created_at`, [randomUUID(), email.trim().toLowerCase(), passwordHash]);
    return result.rows[0];
  }
  static async findByEmail(email) { const result = await query('SELECT * FROM admins WHERE LOWER(email) = LOWER($1)', [email.trim()]); return result.rows[0] || null; }
  static async findById(id) { const result = await query('SELECT id, email, status, created_at FROM admins WHERE id = $1', [id]); return result.rows[0] || null; }
  static async verifyPassword(password, hash) { return bcrypt.compare(password, hash); }
}
