import { sendSimpleEmail } from '../utils/email.js';
import logger from '../config/logger.js';
import { PLATFORM_NAME } from '../config/branding.js';

export const sendAssistance = async (req, res) => {
  try {
    const { objet, message } = req.body;
    if (!objet || !message) {
      return res.status(400).json({ error: 'Objet et message requis' });
    }

    const user = req.user; // après authenticate
    // Récupérer les infos du collège si besoin (on peut les passer depuis le frontend)
    // Mais on peut aussi les lire dans la base.
    // On va utiliser les données envoyées par le frontend pour plus de flexibilité.
    const { collegeNom, nom, prenom, email, role } = req.body;

    const expediteur = `${prenom} ${nom} (${role})`;
    const collegeInfo = collegeNom ? `Collège : ${collegeNom}` : '';

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px;">
        <h2>Demande d'assistance ${PLATFORM_NAME}</h2>
        <p><strong>De :</strong> ${expediteur}</p>
        <p><strong>Email :</strong> ${email || 'non renseigné'}</p>
        <p><strong>${collegeInfo}</strong></p>
        <hr/>
        <p><strong>Objet :</strong> ${objet}</p>
        <p><strong>Message :</strong></p>
        <p style="white-space: pre-wrap;">${message}</p>
        <hr/>
        <p style="font-size: 12px; color: #888;">Envoyé depuis ${PLATFORM_NAME}</p>
      </div>
    `;

    await sendSimpleEmail(
      'vladimirfaton@gmail.com',
      `[${PLATFORM_NAME} Assistance] ${objet}`,
      htmlContent
    );

    logger.info(`Assistance email sent by ${user.email}`);
    res.json({ success: true, message: 'Email envoyé' });
  } catch (error) {
    logger.error(`sendAssistance error: ${error.message}`);
    res.status(500).json({ error: "Erreur lors de l'envoi de l'assistance" });
  }
};
