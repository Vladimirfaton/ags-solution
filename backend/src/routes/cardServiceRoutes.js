import express from 'express';
import { getCardServiceStats, getCardServiceStatus, previewCards, setCardServiceStatus } from '../controllers/cardServiceController.js';
import { authenticate, authorizePermission } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticate);
router.get('/statut', getCardServiceStatus);
router.put('/statut', authorizePermission('fvs.activer'), setCardServiceStatus);
router.get('/stats', authorizePermission('fvs.consulter'), getCardServiceStats);
router.get('/classes/:classId/preview', authorizePermission('fvs.consulter'), previewCards);

export default router;
