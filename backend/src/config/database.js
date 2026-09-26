import { createClient } from '@supabase/supabase-js';
import pg from 'pg';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
dotenv.config({ path: path.join(projectRoot, '.env') });

const { Pool } = pg;

// ====== SUPABASE CLIENT ======
export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// ====== POSTGRESQL POOL (directe) ======
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
});

pool.on('error', (err) => {
  console.error('Pool PostgreSQL error:', { code: err.code, message: err.message });
});

export const query = (text, params) => {
  return pool.query(text, params);
};

export default { supabase, pool, query };
