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
import { FinancialStatement } from '../models/FinancialStatement.js';

export const getPaymentStatus = async (req, res, next) => {
  try {
    const scope = await accessScopeFor(req.user);
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 10));
    const options = { search: req.query.recherche || '', classeAnnuelleId: req.query.classeId || null, statut: req.query.statut || 'tous', page, pageSize };
    const [list, summary] = await Promise.all([FinancialStatement.list(scope, options), FinancialStatement.summary(scope, options)]);
    res.json({ ...list, summary });
  } catch (error) { next(error); }
};

const csvEscape = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;

export const exportPaymentStatus = async (req, res, next) => {
  try {
    const scope = await accessScopeFor(req.user);
    const rows = await FinancialStatement.exportRows(scope, { search: req.query.recherche || '', classeAnnuelleId: req.query.classeId || null, statut: req.query.statut || 'tous' });
    const statutLabel = { solde: 'Soldé', partiel: 'Partiel', impaye: 'Impayé' };
    const header = ['Matricule', 'Nom', 'Prénom', 'Classe', 'Montant dû', 'Montant payé', 'Reste', 'Statut'];
    const lines = [header.map(csvEscape).join(';')];
    for (const row of rows) {
      lines.push([row.matricule, row.nom, row.prenom, row.classe, row.totalDu, row.totalPaye, row.reste, statutLabel[row.statut]].map(csvEscape).join(';'));
    }
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="statut-paiements.csv"');
    res.send('\uFEFF' + lines.join('\n'));
  } catch (error) { next(error); }
};

export const getPaymentHistory = async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 10));
    res.json(await Payment.list(await accessScopeFor(req.user), { search: req.query.recherche || '', page, pageSize }));
  } catch (error) { next(error); }
};
export const getPaymentReceipt = async (req, res, next) => {
  try { res.json(await Payment.getReceiptData(req.params.id, await accessScopeFor(req.user))); } catch (error) { next(error); }
};