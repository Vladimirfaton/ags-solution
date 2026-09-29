import express from 'express';
import { confirmCardServiceSites, getCardServiceStats, getCardServiceStatus, listCardClassesForAdmin, previewCards, setCardServiceStatus } from '../controllers/cardServiceController.js';
import { authenticate, authorize, authorizePermission } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticate);
router.get('/statut', getCardServiceStatus);
router.put('/statut', authorizePermission('fvs.activer'), setCardServiceStatus);
router.put('/autorisation-admin', authorize(['admin']), setCardServiceStatus);
router.put('/sites', authorizePermission('fvs.activer'), confirmCardServiceSites);
router.get('/admin/classes', authorize(['admin']), listCardClassesForAdmin);
router.get('/stats', authorizePermission('fvs.consulter'), getCardServiceStats);
router.get('/classes/:classId/preview', authorizePermission('fvs.consulter'), previewCards);

export default router;
