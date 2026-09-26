import { Establishment } from '../models/Establishment.js';
import crypto from 'crypto';
import { MANAGEMENT_ROLES, User } from '../models/User.js';

export const getSetupStatus = async (_req, res, next) => {
  try { res.json(await Establishment.setupStatus()); } catch (error) { next(error); }
};

export const getEstablishment = async (_req, res, next) => {
  try {
    const etablissement = await Establishment.get();
    if (!etablissement) return res.status(404).json({ error: 'Établissement non configuré' });
    res.json({ etablissement });
  } catch (error) { next(error); }
};

export const getPlatformOverview = async (_req, res, next) => {
  try { res.json(await Establishment.adminOverview()); } catch (error) { next(error); }
};

export const createPlatformSite = async (req, res, next) => {
  let site = null;
  try {
    if (!req.body.nom?.trim()) return res.status(400).json({ error: 'Le nom du site est requis.' });
    site = await Establishment.createSite(req.body);
    const credentials = ['secretaire', 'comptable', 'censeur'].map((role) => ({ role, password: crypto.randomBytes(10).toString('base64url') }));
    const comptes = await User.createSiteManagementAccounts({ siteId: site.id, siteNom: site.nom, credentials });
    const identifiantsFiliale = comptes.map((c, i) => ({ role: c.role, username: c.username, password: credentials[i].password }));
    res.status(201).json({ site, comptes, identifiantsFiliale });
  } catch (error) {
    if (site?.id) {
      try { await Establishment.deleteSite(site.id); } catch (cleanupError) { error.cleanupError = cleanupError.message; }
    }
    next(error);
  }
};

export const initializePlatform = async (req, res, next) => {
  try {
    if (await Establishment.get()) return res.status(409).json({ error: 'La plateforme est déjà initialisée' });
    const { nom, type, sites = [] } = req.body;
    if (!nom) return res.status(400).json({ error: "Le nom de l'établissement est requis" });
    const etablissement = await Establishment.create({ nom, type });
    const cleanSites = Array.isArray(sites) ? sites.filter((site) => site?.nom?.trim()) : [];
    const primaryData = cleanSites[0] || { nom };
    const site = await Establishment.createPrimarySite(primaryData);
    const secondarySites = [];
    const identifiantsFiliales = [];
    for (const siteData of cleanSites.slice(1)) {
      const secondarySite = await Establishment.createSite(siteData);
      const credentials = ['secretaire', 'comptable', 'censeur'].map((role) => ({ role, password: crypto.randomBytes(10).toString('base64url') }));
      const comptesFiliale = await User.createSiteManagementAccounts({ siteId: secondarySite.id, siteNom: secondarySite.nom, credentials });
      secondarySites.push(secondarySite);
      identifiantsFiliales.push({ site: secondarySite.nom, siteId: secondarySite.id, identifiants: comptesFiliale.map((account, index) => ({ role: account.role, username: account.username, password: credentials[index].password })) });
    }
    const credentials = MANAGEMENT_ROLES.map((role) => ({ role, password: crypto.randomBytes(10).toString('base64url') }));
    const comptes = await User.createDefaultManagementAccounts({ credentials });
    res.status(201).json({ etablissement, site, sites: [site, ...secondarySites], comptes, identifiantsInitiaux: credentials, identifiantsFiliales });
  } catch (error) { next(error); }
};
