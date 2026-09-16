import { CashRegister } from '../models/CashRegister.js';
import { Enrollment } from '../models/Enrollment.js';
import { StudentRegistry } from '../models/StudentRegistry.js';
import { Payment } from '../models/Payment.js';
import { accessScopeFor } from '../models/AccessScope.js';

export const getCashOverview = async (req, res, next) => {
 try { res.json(await CashRegister.overview(await accessScopeFor(req.user))); } catch (error) { next(error); }
  };
export const getEnrollmentOptions = async (req, res, next) => {
 try { res.json(await Enrollment.options(await accessScopeFor(req.user), req.query.siteId)); } catch (error) { next(error); }
};
export const createEnrollment = async (req, res, next) => {
  try {
    const { studentId, annualClassId, type = 'reinscription' } = req.body;
    if (!annualClassId) return res.status(400).json({ error: 'La classe est requise.' });
    if (type === 'inscription') {
      const { matricule, nom, prenom } = req.body;
      if (!matricule || !nom || !prenom) return res.status(400).json({ error: 'Matricule, nom et prénom sont requis.' });
    return res.status(201).json({ student: await StudentRegistry.create(req.body, req.user.id, await accessScopeFor(req.user)) });
    }
    if (!studentId) return res.status(400).json({ error: 'Élève et classe sont requis.' });
    res.status(201).json({ inscription: await Enrollment.create(req.body, req.user.id, await accessScopeFor(req.user)) });
  } catch (error) { next(error); }
};
export const getPaymentOptions = async (req, res, next) => { try { res.json({ students: await Payment.options(await accessScopeFor(req.user)) }); } catch (error) { next(error); } };
export const createPayment = async (req, res, next) => {
  try {
   const result = await Payment.create(req.body, req.user.id, await accessScopeFor(req.user));
    res.status(201).json(result);
  } catch (error) { next(error); }
};
