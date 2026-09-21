export const normalizeUsername = (value) =>
  (value || '')
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // retire les accents
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '');

export const generateUsernameSuggestion = (prenom, nom) =>
  normalizeUsername(`${prenom}${nom}`);

export const splitFullName = (fullName = '') => {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  const prenom = parts[0] || '';
  const nom = parts.slice(1).join(' ') || prenom;
  return { prenom, nom };
};
