import logger from '../config/logger.js';

export const errorHandler = (err, req, res, next) => {
  logger.error(`${req.method} ${req.originalUrl} — ${err.message}`);
  if (err.stack) logger.debug(err.stack);

  const knownDatabaseErrors = {
    '23505': 'Cette information existe déjà.',
    '23503': 'Cette opération concerne une information introuvable ou non disponible.',
    '23502': 'Une information obligatoire est manquante.',
    '23514': 'Les informations fournies ne respectent pas les règles attendues.',
  };
  const status = err.status && err.status < 500 ? err.status : (knownDatabaseErrors[err.code] ? 400 : 500);
  const message = err.expose || (err.status && err.status < 500)
    ? err.message
    : (knownDatabaseErrors[err.code] || 'Une erreur technique est survenue. Réessayez ou contactez l’assistance.');

  res.status(status).json({
    error: message,
  });
};

export const notFound = (req, res) => {
  logger.warn(`404 - Route not found: ${req.originalUrl}`);
  res.status(404).json({ error: 'Route non trouvée' });
};
