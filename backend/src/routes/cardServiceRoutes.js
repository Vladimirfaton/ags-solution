import express from 'express';
import { activateCardServiceSite, confirmCardServiceSites, getCardServiceStats, getCardServiceStatus, listCardClassesForAdmin, previewCards, previewCardsForAdmin, setCardServiceStatus } from '../controllers/cardServiceController.js';
import { createCardObservation, deleteCardObservation, getUnreadCardObservations, listCardNotifications, listCardObservations, markCardObservationsRead, sendCardNotification } from '../controllers/cardWorkflowController.js';
import { createCardLostDeclaration, getCardDraft, getCardManagementData, listCardLostDeclarations, listUnreadCardLostDeclarations, markCardLostDeclarationsRead } from '../controllers/cardManagementController.js';
import { getIdentity, signatureUpload, updateIdentity, uploadSignature } from '../controllers/cardIdentityController.js';
import { studentPhotoUpload, updateStudentCard, uploadStudentPhoto } from '../controllers/cardStudentAdminController.js';
import { getEstablishmentCardInfoPage } from '../controllers/cardPublicController.js';
import { authenticate, authorize, authorizePermission } from '../middleware/auth.js';

const cardActor = (req, res, next) => {
  if (req.user?.accountType === 'admin') return next();
  if (['directeur', 'secretaire'].includes(req.user?.role) && req.user.permissions?.includes('fvs.consulter')) return next();
  return res.status(403).json({ error: 'Accès non autorisé' });
};

const router = express.Router();
router.get('/carte-info/:id', getEstablishmentCardInfoPage);
router.use(authenticate);
router.get('/statut', getCardServiceStatus);
router.put('/autorisation-admin', authorize(['admin']), setCardServiceStatus);
router.put('/sites', authorizePermission('fvs.activer'), confirmCardServiceSites);
router.post('/sites/:siteId/activer', authorize(['directeur']), authorizePermission('fvs.activer'), activateCardServiceSite);
router.get('/gestion/donnees', authorizePermission('fvs.consulter'), getCardManagementData);
router.get('/brouillons/:draftId', authorizePermission('fvs.consulter'), getCardDraft);
router.get('/declarations-perte', authorizePermission('fvs.consulter'), listCardLostDeclarations);
router.post('/declarations-perte', authorizePermission('fvs.consulter'), createCardLostDeclaration);
router.get('/admin/declarations-perte/non-lues', authorize(['admin']), listUnreadCardLostDeclarations);
router.put('/admin/declarations-perte/marquer-lues', authorize(['admin']), markCardLostDeclarationsRead);
router.get('/admin/classes', authorize(['admin']), listCardClassesForAdmin);
router.get('/admin/classes/:classId/preview', authorize(['admin']), previewCardsForAdmin);
router.put('/admin/eleves/:studentId', authorize(['admin']), updateStudentCard);
router.post('/admin/eleves/:studentId/photo', authorize(['admin']), studentPhotoUpload, uploadStudentPhoto);
router.get('/admin/identite', authorize(['admin']), getIdentity);
router.put('/admin/identite', authorize(['admin']), updateIdentity);
router.post('/admin/signature', authorize(['admin']), signatureUpload, uploadSignature);
router.get('/admin/observations/non-lues', authorize(['admin']), getUnreadCardObservations);
router.put('/admin/observations/marquer-lues', authorize(['admin']), markCardObservationsRead);
router.get('/admin/notifications', authorize(['admin']), listCardNotifications);
router.post('/admin/notifications', authorize(['admin']), sendCardNotification);
router.get('/stats', authorizePermission('fvs.consulter'), getCardServiceStats);
router.get('/classes/:classId/preview', authorizePermission('fvs.consulter'), previewCards);
router.get('/classes/:classId/observations', cardActor, listCardObservations);
router.post('/classes/:classId/observations', cardActor, createCardObservation);
router.delete('/observations/:observationId', cardActor, deleteCardObservation);

export default router;