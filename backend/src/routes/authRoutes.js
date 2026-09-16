import express from 'express';
import { bootstrapStatus, changeMyPassword, getMyProfile, login, loginGestion, register, requestPasswordReset, resendOtp, resetPassword, updateMyProfile, verifyOtpCode, verifyToken } from '../controllers/authController.js';
import { authenticate, authorizeManagement } from '../middleware/auth.js';
import { loginRateLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();
router.get('/bootstrap-status', bootstrapStatus);
router.post('/register', register);
router.post('/login', loginRateLimiter, login);
router.post('/verify-otp', verifyOtpCode);
router.post('/resend-otp', resendOtp);
router.get('/verify', authenticate, verifyToken);
router.post('/login-gestion', loginRateLimiter, loginGestion);
router.post('/mot-de-passe-oublie', loginRateLimiter, requestPasswordReset);
router.post('/reinitialiser-mot-de-passe', resetPassword);
router.get('/mon-profil', authenticate, authorizeManagement, getMyProfile);
router.put('/mon-profil', authenticate, authorizeManagement, updateMyProfile);
router.put('/mon-mot-de-passe', authenticate, authorizeManagement, changeMyPassword);
export default router;
