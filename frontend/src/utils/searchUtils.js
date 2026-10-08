export const normalizeSearchText = (value = '') =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

export function matchStudentSearch(student, query) {
  const q = normalizeSearchText(query);
  if (!q) return true;

  const fields = [
    student?.matricule,
    student?.nom,
    student?.prenom,
    student?.sexe,
    student?.date_naissance,
    student?.lieu_naissance,
    student?.nationalite,
    student?.telephone,
    student?.photo_path,
  ];

  return fields.some((value) => normalizeSearchText(value).includes(q));
}

export function matchClassSearch(item, query) {
  const q = normalizeSearchText(query);
  if (!q) return true;

  const fields = [
    item?.code_affichage,
    item?.code,
    item?.niveau_code,
    item?.code_niveau,
    item?.niveau,
    item?.niveau_libelle,
    item?.division_nom,
    item?.nom,
    item?.libelle,
  ];

  const matchesField = fields.some((value) => normalizeSearchText(value).includes(q));
  if (matchesField) return true;

  const searchSite = q.length >= 3 && !/^(ci|cp|ce1|ce2|cm1|cm2)(?![a-z])/.test(q);
  if (searchSite && ` ${normalizeSearchText(item?.site_nom)}`.includes(` ${q}`)) return true;

  const levelAliases = {
    primaire: ['ci', 'cp', 'ce1', 'ce2', 'cm1', 'cm2', 'cours d initiation', 'cours initiation'],
    ci: ['cours d initiation', 'cours initiation'],
  };
  const aliases = levelAliases[q] || (q.includes('primaire') ? levelAliases.primaire : null);
  if (!aliases) return false;

  const normalizedFields = fields.map((value) =>
    normalizeSearchText(value).replace(/[’']/g, ' ').replace(/\s+/g, ' ')
  );
  return aliases.some((alias) => normalizedFields.some((value) => value.includes(alias)));
}
