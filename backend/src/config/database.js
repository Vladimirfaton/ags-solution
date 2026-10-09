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
const useSsl = process.env.NODE_ENV === 'production' || /supabase\.(com|co)/.test(process.env.DATABASE_URL || '');

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: useSsl ? { rejectUnauthorized: false } : false,
  max: 5,
  idleTimeoutMillis: 8000,
  connectionTimeoutMillis: 20000,
  keepAlive: true,
  keepAliveInitialDelayMillis: 5000,
});

pool.on('error', (err) => {
  console.error('Pool PostgreSQL error:', { code: err.code, message: err.message });
});

pool.query('SELECT 1').catch((err) => {
  console.error('Préchauffage du pool échoué:', { code: err.code, message: err.message });
});

const transientCodes = ['ECONNRESET', 'ETIMEDOUT', 'EPIPE'];
const isTransient = (error) =>
  transientCodes.includes(error?.code) ||
  /Connection terminated|timeout exceeded when trying to connect/i.test(error?.message || '');
const isReadOnly = (text) => /^\s*(select|with)\b/i.test(text) && !/\b(insert|update|delete)\b/i.test(text);

export const query = async (text, params) => {
  const attempts = isReadOnly(text) ? 3 : 1;
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await pool.query(text, params);
    } catch (error) {
      lastError = error;
      if (!isTransient(error) || attempt === attempts) break;
      await new Promise((resolve) => setTimeout(resolve, 400 * attempt));
    }
  }
  throw lastError;
};

export default { supabase, pool, query };
