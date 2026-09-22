import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 10000,
});

console.log('Tentative de connexion...');
try {
  await client.connect();
  const result = await client.query('SELECT NOW()');
  console.log('✅ Connexion réussie :', result.rows[0]);
  await client.end();
} catch (err) {
  console.error('❌ Échec :', err.message);
}