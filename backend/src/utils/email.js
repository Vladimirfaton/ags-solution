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

const directeurTitle = (sexe) => {
  if (sexe === 'F') return 'Madame la Directrice';
  if (sexe === 'M') return 'Monsieur le Directeur';
  return 'Madame, Monsieur,'; // fallback neutre si sexe non renseigné (collèges déjà existants)
};
export default {
  sendOtpEmail,
  sendSimpleEmail,
};
