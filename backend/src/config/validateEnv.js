import logger from './logger.js';

// Variables sans lesquelles l'app ne doit PAS démarrer.
const REQUIRED = [
  'DATABASE_URL',
  'JWT_SECRET',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_KEY',
  'BREVO_API_KEY',
  'SENDER_EMAIL',
];

// Variables optionnelles : 
const OPTIONAL_WITH_DEFAULT = [
  { name: 'FRONTEND_URL', fallback: 'http://localhost:3000' },
  { name: 'CORS_ORIGIN', fallback: '*' },
  { name: 'PORT', fallback: '3001' },
  { name: 'LOG_LEVEL', fallback: 'info' },
  { name: 'LOG_FILE', fallback: '(non défini — logs console uniquement)' },
  { name: 'PLATFORM_NAME', fallback: 'AGS-Solution' },
  { name: 'SUPABASE_STORAGE_BUCKET', fallback: '(à confirmer si requis)' },
  { name: 'NODE_ENV', fallback: 'development' },
];

export function validateEnv() {
  const missing = REQUIRED.filter((name) => !process.env[name] || process.env[name].trim() === '');
  const isProd = process.env.NODE_ENV === 'production';

  if (missing.length > 0) {
    if (isProd) {
      logger.error('❌ Démarrage impossible — variables d\'environnement requises manquantes :');
      missing.forEach((name) => logger.error(`   - ${name}`));
      logger.error('Vérifiez la configuration Render.');
      process.exit(1);
    } else {
      logger.warn('⚠️  Variables d\'environnement manquantes (toléré en dev, sera bloquant en production) :');
      missing.forEach((name) => logger.warn(`   - ${name}`));
    }
  }

  OPTIONAL_WITH_DEFAULT.forEach(({ name, fallback }) => {
    if (!process.env[name] || process.env[name].trim() === '') {
      logger.warn(`⚠️  ${name} non définie — valeur par défaut utilisée : ${fallback}`);
    }
  });

  logger.info('✅ Variables d\'environnement validées.');
}
