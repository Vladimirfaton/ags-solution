import { pool } from '../config/database.js';
import logger from '../config/logger.js';

const createTables = async () => {
  try {
    logger.info('Creating database tables...');
    await pool.query('ALTER TABLE observations ADD COLUMN IF NOT EXISTS lu_par_admin BOOLEAN DEFAULT false');
    await pool.query('ALTER TABLE observations ADD COLUMN IF NOT EXISTS eleve_id UUID REFERENCES eleves(id) ON DELETE SET NULL');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_observations_non_lues ON observations(lu_par_admin) WHERE lu_par_admin = false');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255),
        role VARCHAR(50) DEFAULT 'admin',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // --- Migration additive users : gestion d'écoles (directeur/secrétaire) ---
    await pool.query('ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL');
    await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS college_id UUID REFERENCES colleges(id) ON DELETE CASCADE');
    await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS username VARCHAR(100) UNIQUE');
    await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS nom VARCHAR(255)');
    await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS prenom VARCHAR(255)');
    await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS telephone VARCHAR(30)');
    // status: active (admin par défaut) | pending_activation | expired
    await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'active'");

    await pool.query(`
      CREATE TABLE IF NOT EXISTS otps (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) NOT NULL,
        code VARCHAR(6) NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS colleges (
        id UUID PRIMARY KEY,
        nom VARCHAR(255) NOT NULL,
        commune VARCHAR(255) NOT NULL,
        departement VARCHAR(255) NOT NULL,
        directeur_nom VARCHAR(255),
        directeur_prenom VARCHAR(255),
        directeur_contact VARCHAR(255),
        email VARCHAR(255),
        telephone VARCHAR(30),
        signature_path TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // --- Migration additive colleges : infos secrétaire (facultatives à la création) ---
    await pool.query('ALTER TABLE colleges ADD COLUMN IF NOT EXISTS secretaire_nom VARCHAR(255)');
    await pool.query('ALTER TABLE colleges ADD COLUMN IF NOT EXISTS secretaire_prenom VARCHAR(255)');
    await pool.query('ALTER TABLE colleges ADD COLUMN IF NOT EXISTS secretaire_telephone VARCHAR(30)');
    await pool.query('ALTER TABLE colleges ADD COLUMN IF NOT EXISTS secretaire_email VARCHAR(255)');
    await pool.query('ALTER TABLE colleges ADD COLUMN IF NOT EXISTS directeur_prenom VARCHAR(255)');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS classes (
        id UUID PRIMARY KEY,
        college_id UUID NOT NULL REFERENCES colleges(id) ON DELETE CASCADE,
        niveau VARCHAR(50) NOT NULL,
        serie VARCHAR(20) NOT NULL,
        code VARCHAR(80) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT uniq_classe_college UNIQUE (college_id, niveau, serie)
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS eleves (
        id UUID PRIMARY KEY,
        classe_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
        matricule VARCHAR(50) UNIQUE NOT NULL,
        nom VARCHAR(255) NOT NULL,
        prenom VARCHAR(255) NOT NULL,
        sexe VARCHAR(1),
        date_naissance DATE,
        lieu_naissance VARCHAR(255),
        nationalite VARCHAR(255),
        telephone VARCHAR(30),
        photo_path TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS brouillons_cartes (
        id UUID PRIMARY KEY,
        college_id UUID NOT NULL REFERENCES colleges(id) ON DELETE CASCADE,
        classe_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
        nom_brouillon VARCHAR(255) NOT NULL,
        export_path TEXT,
        total_cartes INTEGER,
        status VARCHAR(50) DEFAULT 'draft',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // --- Nouvelle table : clés d'accès (partagées directeur+secrétaire d'un même collège) ---
    await pool.query(`
      CREATE TABLE IF NOT EXISTS access_keys (
        id UUID PRIMARY KEY,
        college_id UUID NOT NULL REFERENCES colleges(id) ON DELETE CASCADE,
        key_hash VARCHAR(255) NOT NULL,
        type VARCHAR(20) NOT NULL DEFAULT 'free',
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        issued_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        activated_at TIMESTAMP,
        expires_at TIMESTAMP
      )
    `);

    // --- Nouvelle table : observations (retour secrétaire/directeur après vérification élèves) ---
    await pool.query(`
      CREATE TABLE IF NOT EXISTS observations (
        id UUID PRIMARY KEY,
        classe_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
        auteur_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        auteur_role VARCHAR(50) NOT NULL,
        contenu TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await pool.query(`
  CREATE TABLE IF NOT EXISTS notifications_brouillon (
    id UUID PRIMARY KEY,
    college_id UUID NOT NULL REFERENCES colleges(id) ON DELETE CASCADE,
    classe_id UUID REFERENCES classes(id) ON DELETE SET NULL,
    sent_by UUID REFERENCES users(id) ON DELETE SET NULL,
    sent_at TIMESTAMP DEFAULT NOW(),
    emails_sent INTEGER DEFAULT 0
  )
`);
await pool.query(`
  CREATE TABLE IF NOT EXISTS notifications_cartes (
    id UUID PRIMARY KEY,
    college_id UUID NOT NULL REFERENCES colleges(id) ON DELETE CASCADE,
    classe_id UUID REFERENCES classes(id) ON DELETE SET NULL,
    sent_by UUID REFERENCES users(id) ON DELETE SET NULL,
    sent_at TIMESTAMP DEFAULT NOW(),
    emails_sent INTEGER DEFAULT 0,
    date_passage TIMESTAMP
  )
`);
await pool.query('CREATE INDEX IF NOT EXISTS idx_notif_cartes_college ON notifications_cartes(college_id)');
await pool.query('CREATE INDEX IF NOT EXISTS idx_notif_brouillon_college ON notifications_brouillon(college_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_colleges_commune ON colleges(commune, departement)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_classes_college ON classes(college_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_eleves_classe ON eleves(classe_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_eleves_matricule ON eleves(matricule)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_users_college ON users(college_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_access_keys_college ON access_keys(college_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_observations_classe ON observations(classe_id)');

    logger.info('Database setup completed');
  } catch (error) {
    logger.error(`Database setup error: ${error.message}`);
    process.exit(1);
  }
};

createTables().then(() => {
  pool.end();
  process.exit(0);
});