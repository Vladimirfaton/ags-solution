import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import logger from '../config/logger.js';
import { User } from '../models/User.js';
import { Admin } from '../models/Admin.js';
import { Session } from '../models/Session.js';
import { generateOTP, saveOTP, verifyOTP } from '../utils/otpUtils.js';
import { sendOtpEmail, sendSimpleEmail } from '../utils/email.js';
import { normalizeUsername } from '../utils/username.js';
import { isValidPassword } from '../utils/validators.js';
import { PLATFORM_NAME } from '../config/branding.js';

const hash = (value) => crypto.createHash('sha256').update(value).digest('hex');
const SESSION_SECONDS = 7 * 24 * 60 * 60;
const publicUser = (user, accountType = 'gestion') => accountType === 'admin'
  ? ({ id: user.id, email: user.email, role: 'admin' })
  : ({ id: user.id, email: user.email, role: user.role, username: user.username, usernameLocked: user.username_locked, nom: user.nom, prenom: user.prenom, passwordPersonalized: user.password_personalized, permissions: user.permissions || [] });
const issueSession = async (user, req, accountType = 'gestion') => {
  const jti = crypto.randomUUID();
  await Session.create({ accountType, accountId: user.id, tokenId: jti, deviceLabel: req.get('user-agent'), expiresAt: new Date(Date.now() + SESSION_SECONDS * 1000), maxSessions: accountType === 'admin' ? 2 : 1 });
  return { token: jwt.sign({ id: user.id, email: user.email, role: accountType === 'admin' ? 'admin' : user.role, accountType, jti }, process.env.JWT_SECRET, { expiresIn: `${SESSION_SECONDS}s` }), user: publicUser(user, accountType) };
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = email && password ? await Admin.findByEmail(email) : null;
    if (!user || !(await Admin.verifyPassword(password, user.password_hash))) return res.status(401).json({ error: 'Identifiants invalides' });
    const otpCode = generateOTP(); await saveOTP(user.email, otpCode); await sendOtpEmail(user.email, otpCode);
    return res.json({ message: 'Un code OTP a été envoyé à votre email', email: user.email, requiresOTP: true });
  } catch (error) { logger.error(`Login admin: ${error.message}`); return res.status(500).json({ error: "Erreur lors de l'envoi du code OTP" }); }
};
export const verifyOtpCode = async (req, res) => {
  try {
    const { email, otpCode } = req.body;
    if (!email || !otpCode || !(await verifyOTP(email, otpCode))) return res.status(401).json({ error: 'Code OTP invalide ou expiré' });
    const user = await Admin.findByEmail(email);
    if (!user || user.status !== 'active') return res.status(401).json({ error: 'Compte indisponible' });
    return res.json(await issueSession(user, req, 'admin'));
  } catch (error) { logger.error(`OTP: ${error.message}`); return res.status(500).json({ error: 'Erreur lors de la vérification' }); }
};
export const register = async (req, res) => {
  try {
    const { email, password, confirmPassword } = req.body;
    if (!email || !password || !confirmPassword) return res.status(400).json({ error: 'Tous les champs sont requis' });
    if (password !== confirmPassword || !isValidPassword(password)) return res.status(400).json({ error: 'Mot de passe invalide ou non confirmé' });
    if (await Admin.count()) return res.status(403).json({ error: 'Le premier administrateur existe déjà.' });
    return res.status(201).json(await issueSession(await Admin.create(email, password), req, 'admin'));
  } catch (error) { logger.error(`Création admin: ${error.message}`); return res.status(500).json({ error: "Erreur lors de l'enregistrement" }); }
};
export const resendOtp = async (req, res) => {
  try { const user = await Admin.findByEmail(req.body.email || ''); if (!user) return res.status(404).json({ error: 'Utilisateur non trouvé' }); const otpCode = generateOTP(); await saveOTP(user.email, otpCode); await sendOtpEmail(user.email, otpCode); return res.json({ message: 'Nouveau code envoyé', email: user.email }); }
  catch (error) { return res.status(500).json({ error: "Erreur lors de l'envoi du code" }); }
};
export const verifyToken = (req, res) => res.json({ valid: true, user: publicUser(req.user, req.user.accountType) });
export const loginGestion = async (req, res) => {
  try {
    const username = normalizeUsername(req.body.username || ''); const { password } = req.body;
    const user = username && password ? await User.findByUsername(username) : null;
    if (!user || !User.isManagementRole(user.role) || !(await User.verifyPassword(password, user.password_hash))) return res.status(401).json({ error: 'Identifiants invalides' });
    if (user.status !== 'active' || user.disabled_at) return res.status(403).json({ error: 'Compte désactivé', code: 'ACCOUNT_DISABLED' });
    return res.json(await issueSession(user, req));
  } catch (error) { logger.error(`Connexion gestion: ${error.message}`); return res.status(500).json({ error: 'Erreur lors de la connexion' }); }
};
export const getMyProfile = async (req, res) => res.json({ user: publicUser(req.user) });
export const updateMyProfile = async (req, res) => {
  try { const user = await User.setProfile(req.user.id, req.body); return res.json({ user: publicUser({ ...user, permissions: req.user.permissions }) }); }
  catch (error) { return res.status(error.status || 400).json({ error: error.expose ? error.message : 'Impossible de mettre à jour les informations personnelles' }); }
};
export const changeMyPassword = async (req, res) => {
  const { currentPassword, newPassword, confirmPassword } = req.body;
  if (!currentPassword || !newPassword || newPassword !== confirmPassword || !isValidPassword(newPassword)) return res.status(400).json({ error: 'Nouveau mot de passe invalide ou non confirmé' });
  if (!(await User.changePassword(req.user.id, currentPassword, newPassword))) return res.status(401).json({ error: 'Mot de passe actuel incorrect' });
  return res.json({ success: true });
};
export const requestPasswordReset = async (req, res) => {
  try {
    const user = await User.findByUsername(normalizeUsername(req.body.username || ''));
    if (user && User.isManagementRole(user.role) && user.email) {
      const token = crypto.randomBytes(32).toString('hex');
      await User.setResetToken(user.id, hash(token), new Date(Date.now() + 30 * 60 * 1000));
      const url = `${(process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/+$/, '')}/reinitialiser-mot-de-passe?token=${token}`;
      await sendSimpleEmail(user.email, `Réinitialisation du mot de passe — ${PLATFORM_NAME}`, `<p>Utilisez ce lien dans les 30 minutes :</p><p><a href="${url}">Réinitialiser mon mot de passe</a></p>`);
    }
    return res.json({ message: 'Si un email est renseigné pour ce compte, un lien sécurisé vient d’être envoyé.' });
  } catch (error) { logger.error(`Réinitialisation: ${error.message}`); return res.status(500).json({ error: "Erreur lors de l'envoi" }); }
};
export const resetPassword = async (req, res) => {
  const { token, password, confirmPassword } = req.body;
  if (!token || !password || password !== confirmPassword || !isValidPassword(password)) return res.status(400).json({ error: 'Mot de passe invalide ou non confirmé' });
  if (!(await User.resetPassword(hash(token), password))) return res.status(401).json({ error: 'Lien invalide ou expiré' });
  return res.json({ success: true });
};
export const bootstrapStatus = async (_req, res) => res.json({ adminExists: (await Admin.count()) > 0 });
