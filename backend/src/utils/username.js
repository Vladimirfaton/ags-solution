export const normalizeUsername = (value) =>
  (value || '')
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // retire les accents
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '');

export const generateUsernameSuggestion = (prenom, nom) =>
  normalizeUsername(`${prenom}${nom}`);

// "Jean Baptiste Koffi" -> { prenom: 'Jean', nom: 'Baptiste Koffi' }
// Heuristique : premier mot = prénom, reste = nom. À ajuster si le champ
// directeur_nom est en réalité déjà structuré différemment côté College.
export const splitFullName = (fullName = '') => {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  const prenom = parts[0] || '';
  const nom = parts.slice(1).join(' ') || prenom;
  return { prenom, nom };
};
