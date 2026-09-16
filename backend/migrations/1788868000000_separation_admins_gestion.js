/** Sépare les comptes internes FVS des comptes de gestion de l'établissement. */
export const up = (pgm) => {
  pgm.createTable('admins', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    email: { type: 'varchar(255)', notNull: true, unique: true },
    password_hash: { type: 'varchar(255)', notNull: true },
    status: { type: 'varchar(30)', notNull: true, default: 'active' },
    created_at: { type: 'timestamp', notNull: true, default: pgm.func('CURRENT_TIMESTAMP') },
    updated_at: { type: 'timestamp', notNull: true, default: pgm.func('CURRENT_TIMESTAMP') },
  });
  pgm.sql(`INSERT INTO admins (id, email, password_hash, status, created_at, updated_at)
    SELECT id, email, password_hash, status, created_at, updated_at FROM users WHERE role = 'admin'`);
  // Les rares sessions admin existantes sont volontairement invalidées : le
  // prochain login crée une session dans la table séparée.
  pgm.sql(`DELETE FROM sessions_utilisateur WHERE user_id IN (SELECT id FROM users WHERE role = 'admin')`);
  pgm.sql("DELETE FROM users WHERE role = 'admin'");
  pgm.renameTable('sessions_utilisateur', 'sessions_gestion');
  pgm.createTable('sessions_admin', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    admin_id: { type: 'uuid', notNull: true, references: 'admins(id)', onDelete: 'CASCADE' },
    token_id: { type: 'uuid', notNull: true, unique: true },
    device_label: { type: 'varchar(255)' },
    last_activity_at: { type: 'timestamp', notNull: true, default: pgm.func('CURRENT_TIMESTAMP') },
    revoked_at: { type: 'timestamp' },
    revoke_reason: { type: 'varchar(100)' },
    expires_at: { type: 'timestamp', notNull: true },
    created_at: { type: 'timestamp', notNull: true, default: pgm.func('CURRENT_TIMESTAMP') },
  });
  pgm.createIndex('sessions_admin', ['admin_id', 'revoked_at'], { name: 'idx_sessions_admin_actives' });
  pgm.alterColumn('users', 'role', { default: null });
  pgm.addConstraint('users', 'users_role_gestion_only', "CHECK (role IN ('directeur', 'secretaire', 'comptable', 'censeur'))");
};

export const down = () => { throw new Error('Séparation admins/gestion non réversible.'); };
