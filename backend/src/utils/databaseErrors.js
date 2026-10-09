const DATABASE_ERROR_CODES = new Set([
  '08000', '08001', '08003', '08004', '08006', '57P01', '57P02', '57P03',
  '53300', '53400', 'ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'ENETUNREACH', 'ENOTFOUND', 'EPIPE',
]);

const DATABASE_ERROR_MESSAGES = [
  'connection terminated',
  'connection timeout',
  'connection refused',
  'connection ended unexpectedly',
  'timeout exceeded when trying to connect',
  'the server closed the connection unexpectedly',
  'terminating connection due to administrator command',
  'client has encountered a connection error',
];

export const isDatabaseUnavailable = (error) => {
  const message = String(error?.message || '').toLowerCase();
  return DATABASE_ERROR_CODES.has(error?.code)
    || DATABASE_ERROR_MESSAGES.some((fragment) => message.includes(fragment));
};

export const sendDatabaseUnavailable = (res) => {
  res.set('Retry-After', '10');
  return res.status(503).json({
    error: 'Service de données temporairement indisponible',
    code: 'DATABASE_UNAVAILABLE',
  });
};