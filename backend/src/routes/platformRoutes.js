import express from 'express';
import { createPlatformSite, getEstablishment, getPlatformOverview, getSetupStatus, initializePlatform } from '../controllers/platformController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();
router.get('/setup-status', getSetupStatus);
router.get('/etablissement', authenticate, getEstablishment);
router.get('/apercu', authenticate, authorize(['admin']), getPlatformOverview);
router.post('/initialisation', authenticate, authorize(['admin']), initializePlatform);
router.post('/sites', authenticate, authorize(['admin']), createPlatformSite);
export default router;
