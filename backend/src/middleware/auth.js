import jwt from 'jsonwebtoken';
import logger from '../config/logger.js';
import { User } from '../models/User.js';
import { Admin } from '../models/Admin.js';
import { Session } from '../models/Session.js';

export const authenticate = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Token manquant' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const accountType = decoded.accountType === 'admin' ? 'admin' : 'gestion';
    if (!decoded.jti || !(await Session.isActive(accountType, decoded.id, decoded.jti))) return res.status(401).json({ error: 'Session expirée ou remplacée' });
    const user = accountType === 'admin' ? await Admin.findById(decoded.id) : await User.findById(decoded.id);
    if (!user || user.status !== 'active' || user.disabled_at) return res.status(403).json({ error: 'Compte désactivé', code: 'ACCOUNT_DISABLED' });
    const permissions = accountType === 'gestion' ? await User.permissionsFor(user.id) : [];
    req.user = { ...decoded, ...user, permissions };
    Session.touch(accountType, decoded.id, decoded.jti).catch((error) => logger.warn(`Session touch: ${error.message}`));
    next();
  } catch (error) {
    logger.warn(`Authentification refusée: ${error.message}`);
    return res.status(401).json({ error: 'Token invalide ou expiré' });
  }
};

export const authorize = (roles = []) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'Non authentifié' });
  if (roles.length && !roles.includes(req.user.role)) return res.status(403).json({ error: 'Accès non autorisé' });
  next();
};
const ROLE_PERMISSIONS = Object.freeze({
directeur: ['etablissement.consulter', 'annee_scolaire.gerer', 'classe.consulter', 'eleve.consulter'],
secretaire: ['classe.consulter', 'classe.gerer', 'eleve.consulter', 'eleve.modifier', 'eleve.transferer'],
 comptable: ['classe.consulter', 'eleve.consulter', 'inscription.creer', 'frais.gerer', 'caisse.gerer'],  censeur: ['classe.consulter', 'eleve.consulter'],
});
export const authorizePermission = (...permissions) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'Non authentifié' });
  const rolePermissions = ROLE_PERMISSIONS[req.user.role] || [];
 if (!permissions.every((permission) =>
   rolePermissions.includes(permission) && req.user.permissions?.includes(permission)
)) return res.status(403).json({ error: 'Accès non autorisé' });
  next();
};

export const authorizeManagement = (req, res, next) => {
  if (req.user?.accountType !== 'gestion') return res.status(403).json({ error: 'Accès non autorisé' });
  next();
};

export const checkAccountActive = (_req, _res, next) => next();
