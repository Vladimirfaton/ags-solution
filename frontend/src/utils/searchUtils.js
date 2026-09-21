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
    item?.site_nom,
    item?.niveau,
    item?.division_nom,
    item?.nom,
    item?.libelle,
  ];

  return fields.some((value) => normalizeSearchText(value).includes(q));
}
