// Nom utilisé dans les réponses API et les emails de la plateforme principale.
// FVS Cartes conserve son identité propre dans les fonctions liées aux cartes.
export const PLATFORM_NAME = process.env.PLATFORM_NAME || 'AGS-Solution';
export const PLATFORM_SENDER_NAME = process.env.SENDER_NAME || `${PLATFORM_NAME} Admin`;
