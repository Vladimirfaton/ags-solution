import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { pool } from './src/config/database.js';

const CONFIRMATION = 'VIDER LA BASE';
const PRESERVED_TABLES = [
  'admins', 'pgmigrations', 'modules_plateforme', 'permissions',
  'profils_acces', 'profil_permissions', 'niveaux_scolaires', 'cycles', 'matieres',
];
const quoteIdentifier = (value) => `"${value.replaceAll('"', '""')}"`;

const resetDatabase = async () => {
  const rl = readline.createInterface({ input, output });
  try {
    const answer = await rl.question(
      `ATTENTION : toutes les données métier et les comptes de gestion seront supprimés.\n` +
      `Les admins, migrations et référentiels seront conservés.\n` +
      `Tapez exactement « ${CONFIRMATION} » pour continuer : `,
    );
    if (answer.trim() !== CONFIRMATION) {
      console.log('Opération annulée.');
      return;
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query(
        `SELECT tablename FROM pg_catalog.pg_tables
          WHERE schemaname = 'public' AND tablename <> ALL($1::text[])
          ORDER BY tablename`,
        [PRESERVED_TABLES],
      );
      const tables = rows.map(({ tablename }) => quoteIdentifier(tablename));
      if (tables.length) {
        await client.query(`TRUNCATE TABLE ${tables.join(', ')} RESTART IDENTITY CASCADE`);
      }
      await client.query('COMMIT');
      console.log(`Base vidée : ${rows.length} tables nettoyées.`);
      console.log('Les comptes admins, le schéma, les migrations et les référentiels sont conservés.');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error(`Échec du reset : ${error.message}`);
    process.exitCode = 1;
  } finally {
    rl.close();
    await pool.end();
  }
};

resetDatabase();
