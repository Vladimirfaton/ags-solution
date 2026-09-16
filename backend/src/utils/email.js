import axios from 'axios';
import logger from '../config/logger.js';
import { PLATFORM_NAME, PLATFORM_SENDER_NAME } from '../config/branding.js';

const BREVO_API_URL = 'https://api.brevo.com/v3';
const BREVO_API_KEY = process.env.BREVO_API_KEY;

export const sendOtpEmail = async (email, otpCode) => {
  try {
    if (!BREVO_API_KEY) {
      logger.error('BREVO_API_KEY not configured');
      throw new Error('Email service not configured');
    }

    await axios.post(
      `${BREVO_API_URL}/smtp/email`,
      {
        to: [{ email }],
        sender: {
          name: PLATFORM_SENDER_NAME,
          email: process.env.SENDER_EMAIL || 'noreply@fvs.com',
        },
        subject: `Votre code de vérification OTP - ${PLATFORM_NAME}`,
        htmlContent: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 10px;">
              <h2 style="color: #1e3a8a; margin-bottom: 20px;">Vérification de Connexion</h2>
              <p style="color: #333; font-size: 16px; margin-bottom: 20px;">Bonjour,</p>
              <p style="color: #333; font-size: 16px; margin-bottom: 20px;">
                Vous avez demandé une vérification de connexion. Utilisez le code ci-dessous pour continuer :
              </p>
              <div style="background-color: #1e3a8a; padding: 20px; border-radius: 8px; text-align: center; margin-bottom: 20px;">
                <p style="color: white; font-size: 36px; font-weight: bold; letter-spacing: 5px; margin: 0;">
                  ${otpCode}
                </p>
              </div>
              <p style="color: #666; font-size: 14px; margin-bottom: 10px;">
                ⏱️ <strong>Ce code expire dans 3 minutes</strong>
              </p>
              <p style="color: #666; font-size: 14px; margin-bottom: 20px;">
                Si vous n'avez pas demandé cette vérification, ignorez cet email.
              </p>
              <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
              <p style="color: #999; font-size: 12px; text-align: center;">
                ${PLATFORM_NAME} - Application de gestion scolaire
              </p>
            </div>
          </div>
        `,
      },
      { headers: { 'api-key': BREVO_API_KEY, 'Content-Type': 'application/json' } }
    );

    logger.info(`OTP email sent successfully to ${email}`);
    return true;
  } catch (error) {
    logger.error(`Failed to send OTP email: ${error.message}`);
    throw error;
  }
};

export const sendSimpleEmail = async (email, subject, htmlContent) => {
  try {
    if (!BREVO_API_KEY) {
      logger.error('BREVO_API_KEY not configured');
      throw new Error('Email service not configured');
    }

    await axios.post(
      `${BREVO_API_URL}/smtp/email`,
      {
        to: [{ email }],
        sender: {
          name: PLATFORM_SENDER_NAME,
          email: process.env.SENDER_EMAIL || 'noreply@fvs.com',
        },
        subject,
        htmlContent,
      },
      { headers: { 'api-key': BREVO_API_KEY, 'Content-Type': 'application/json' } }
    );

    logger.info(`Email sent successfully to ${email}`);
    return true;
  } catch (error) {
    logger.error(`Failed to send email: ${error.message}`);
    throw error;
  }
};

const roleLabel = (role) => (role === 'directeur' ? 'Directeur / Directrice' : 'Secrétaire');

export const sendActivationEmail = async (email, { role, collegeName, suggestedUsername, accessKey, activationUrl }) => {
  const subject = `Activation de votre espace ${PLATFORM_NAME} - ${collegeName}`;
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #f7faf8; padding: 24px; border-radius: 10px;">
        <h2 style="color: #059669; margin-bottom: 16px;">Bienvenue sur ${PLATFORM_NAME}</h2>
        <p style="color: #333; font-size: 15px;">
          Un espace de gestion vient d'être créé pour vous en tant que <strong>${roleLabel(role)}</strong>
          du collège <strong>${collegeName}</strong>.
        </p>
        <p style="color: #333; font-size: 15px;">
          Identifiant suggéré (modifiable à l'activation) : <strong>${suggestedUsername}</strong>
        </p>
        <div style="background-color: #059669; padding: 16px; border-radius: 8px; text-align: center; margin: 20px 0;">
          <p style="color: white; font-size: 12px; text-transform: uppercase; margin: 0 0 6px;">Clé d'accès</p>
          <p style="color: white; font-size: 26px; font-weight: bold; letter-spacing: 3px; margin: 0;">${accessKey}</p>
        </div>
        <p style="color: #666; font-size: 13px;">
          Cette clé est valable 155 jours. Cliquez ci-dessous pour activer votre compte :
        </p>
        <p style="text-align: center; margin: 24px 0;">
          <a href="${activationUrl}" style="background-color: #059669; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold;">
            Activer mon compte
          </a>
        </p>
        <p style="color: #999; font-size: 12px; text-align: center;">${PLATFORM_NAME} - Application de gestion scolaire</p>
      </div>
    </div>
  `;
  return sendSimpleEmail(email, subject, htmlContent);
};

export const sendReactivationEmail = async (email, { collegeName, accessKey, reactivationUrl }) => {
  const subject = `Renouvellement de votre accès ${PLATFORM_NAME} - ${collegeName}`;
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #f7faf8; padding: 24px; border-radius: 10px;">
        <h2 style="color: #059669; margin-bottom: 16px;">Paiement confirmé</h2>
        <p style="color: #333; font-size: 15px;">
          Votre nouvel accès à l'espace de gestion du collège <strong>${collegeName}</strong> est prêt.
        </p>
        <div style="background-color: #059669; padding: 16px; border-radius: 8px; text-align: center; margin: 20px 0;">
          <p style="color: white; font-size: 12px; text-transform: uppercase; margin: 0 0 6px;">Nouvelle clé d'accès</p>
          <p style="color: white; font-size: 26px; font-weight: bold; letter-spacing: 3px; margin: 0;">${accessKey}</p>
        </div>
        <p style="color: #666; font-size: 13px;">Cette clé est valable 365 jours.</p>
        <p style="text-align: center; margin: 24px 0;">
          <a href="${reactivationUrl}" style="background-color: #059669; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold;">
            Renouveler mon accès
          </a>
        </p>
        <p style="color: #999; font-size: 12px; text-align: center;">${PLATFORM_NAME} - Application de gestion scolaire</p>
      </div>
    </div>
  `;
  return sendSimpleEmail(email, subject, htmlContent);
};

export const sendLoginLinkEmail = async (email, { role, collegeName, loginUrl }) => {
  const subject = `Votre espace ${PLATFORM_NAME} est activé - ${collegeName}`;
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #f7faf8; padding: 24px; border-radius: 10px;">
        <h2 style="color: #059669; margin-bottom: 16px;">Compte activé avec succès</h2>
        <p style="color: #333; font-size: 15px;">
          Votre espace <strong>${roleLabel(role)}</strong> du collège <strong>${collegeName}</strong> est prêt.
        </p>
        <p style="text-align: center; margin: 24px 0;">
          <a href="${loginUrl}" style="background-color: #059669; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold;">
            Accéder à mon espace
          </a>
        </p>
        <p style="color: #666; font-size: 13px; text-align: center;">
          Ou copiez ce lien : <a href="${loginUrl}">${loginUrl}</a>
        </p>
        <p style="color: #999; font-size: 12px; text-align: center;">${PLATFORM_NAME} - Application de gestion scolaire</p>
      </div>
    </div>
  `;
  return sendSimpleEmail(email, subject, htmlContent);
};

// Envoyé par l'admin pour notifier que le brouillon d'une classe ou du collège est prêt
export const sendBrouillonReadyEmail = async (email, { role, collegeName, classeCode, loginUrl }) => {
  const scope = classeCode ? `la classe <strong>${classeCode}</strong>` : `votre collège`;
  const subject = classeCode
    ? `Brouillon prêt — ${classeCode} · ${collegeName}`
    : `Brouillon prêt — ${collegeName}`;

  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #f7faf8; padding: 24px; border-radius: 10px;">
        <h2 style="color: #059669; margin-bottom: 16px;">Brouillon disponible</h2>
        <p style="color: #333; font-size: 15px;">
          Bonjour <strong>${roleLabel(role)}</strong>,
        </p>
        <p style="color: #333; font-size: 15px;">
          Le brouillon des fiches de ${scope} <strong>${collegeName}</strong>
          est disponible. Vous pouvez le consulter et le télécharger depuis votre espace de gestion.
        </p>
        <p style="color: #666; font-size: 13px;">
          Pensez à vérifier les informations et à ajouter vos observations si nécessaire.
        </p>
        <p style="text-align: center; margin: 24px 0;">
          <a href="${loginUrl}" style="background-color: #059669; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold;">
            Accéder à mon espace
          </a>
        </p>
        <p style="color: #999; font-size: 12px; text-align: center;">${PLATFORM_NAME} - Application de gestion scolaire</p>
      </div>
    </div>
  `;
  return sendSimpleEmail(email, subject, htmlContent);
};
const formatDatePassage = (isoString) => {
  try {
    return new Date(isoString).toLocaleString('fr-FR', {
      dateStyle: 'full',
      timeStyle: 'short',
      timeZone: 'Africa/Porto-Novo',
    });
  } catch {
    return isoString;
  }
};

// Envoyé par l'admin pour notifier que les cartes d'une classe ou du collège sont prêtes
export const sendCartesReadyEmail = async (email, { role, collegeName, classeCode, datePassage, loginUrl }) => {
  const scope = classeCode ? `la classe <strong>${classeCode}</strong>` : `votre collège`;
  const subject = classeCode
    ? `Cartes prêtes — ${classeCode} · ${collegeName}`
    : `Cartes prêtes — ${collegeName}`;
  const dateFormatted = formatDatePassage(datePassage);

  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #f7faf8; padding: 24px; border-radius: 10px;">
        <h2 style="color: #059669; margin-bottom: 16px;">Cartes prêtes</h2>
        <p style="color: #333; font-size: 15px;">
          Bonjour <strong>${roleLabel(role)}</strong>,
        </p>
        <p style="color: #333; font-size: 15px;">
          Les cartes d'identité scolaire de ${scope} <strong>${collegeName}</strong>
          sont prêtes.
        </p>
        <div style="background-color: #059669; padding: 16px; border-radius: 8px; text-align: center; margin: 20px 0;">
          <p style="color: white; font-size: 12px; text-transform: uppercase; margin: 0 0 6px;">Date de passage</p>
          <p style="color: white; font-size: 20px; font-weight: bold; margin: 0;">${dateFormatted}</p>
        </div>
        <p style="text-align: center; margin: 24px 0;">
          <a href="${loginUrl}" style="background-color: #059669; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold;">
            Accéder à mon espace
          </a>
        </p>
        <p style="color: #999; font-size: 12px; text-align: center;">${PLATFORM_NAME} - Application de gestion scolaire</p>
      </div>
    </div>
  `;
  return sendSimpleEmail(email, subject, htmlContent);
};
const directeurTitle = (sexe) => {
  if (sexe === 'F') return 'Madame la Directrice';
  if (sexe === 'M') return 'Monsieur le Directeur';
  return 'Madame, Monsieur,'; // fallback neutre si sexe non renseigné (collèges déjà existants)
};

export const sendExpirationEmail = async (email, { collegeName, directeurSexe, reactivationUrl }) => {
  const subject = `Accès expiré — ${collegeName}`;
  const salutation = directeurTitle(directeurSexe);
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #f7faf8; padding: 24px; border-radius: 10px;">
        <h2 style="color: #dc2626; margin-bottom: 16px;">Accès expiré</h2>
        <p style="color: #333; font-size: 15px;">${salutation}</p>
        <p style="color: #333; font-size: 15px;">
          L'accès à l'espace de gestion du collège <strong>${collegeName}</strong> est arrivé à expiration.
          Les comptes directeur et secrétaire sont désormais désactivés.
        </p>
        <p style="color: #333; font-size: 15px;">
          Pour restaurer l'accès, merci de procéder au renouvellement via le lien ci-dessous :
        </p>
        <p style="text-align: center; margin: 24px 0;">
          <a href="${reactivationUrl}" style="background-color: #059669; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold;">
            Renouveler l'accès
          </a>
        </p>
        <p style="color: #999; font-size: 12px; text-align: center;">${PLATFORM_NAME} - Application de gestion scolaire</p>
      </div>
    </div>
  `;
  return sendSimpleEmail(email, subject, htmlContent);
};
export default {
  sendOtpEmail,
  sendSimpleEmail,
  sendActivationEmail,
  sendReactivationEmail,
  sendLoginLinkEmail,
  sendBrouillonReadyEmail,
  sendCartesReadyEmail,
  sendExpirationEmail
};
