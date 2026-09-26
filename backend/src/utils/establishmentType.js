export const PRIMARY_LEVEL_CODES = ['CI', 'CP', 'CE1', 'CE2', 'CM1', 'CM2'];
export const COLLEGE_LEVEL_CODES = ['6e', '5e', '4e', '3e', '2nde', '1ere', 'terminale'];

export const allowedLevelCodes = (type) => type === 'primaire' ? PRIMARY_LEVEL_CODES : COLLEGE_LEVEL_CODES;
