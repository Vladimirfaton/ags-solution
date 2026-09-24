import { Establishment } from '../models/Establishment.js';
import { AcademicStructure } from '../models/AcademicStructure.js';
import { FinancialConfiguration } from '../models/FinancialConfiguration.js';
import { accessScopeFor } from '../models/AccessScope.js';

export const getOverview = async (_req, res, next) => {
  try { res.json(await Establishment.directorOverview()); } catch (error) { next(error); }
};
export const getFinancialConfiguration = async (req, res, next) => {
 try {
   res.json(await FinancialConfiguration.get(
    await accessScopeFor(req.user),
      req.query.siteId
    ));
  } catch (error) { next(error); }
};

export const createSchoolYear = async (req, res, next) => {
  try {
    const { libelle, moisDebut, moisFin } = req.body;
    if (!libelle || !/^\d{4}-(0[1-9]|1[0-2])$/.test(moisDebut || '') || !/^\d{4}-(0[1-9]|1[0-2])$/.test(moisFin || '')) return res.status(400).json({ error: 'Libellé, mois de début et mois de fin (AAAA-MM) sont requis.' });
    if (moisFin <= moisDebut) return res.status(400).json({ error: 'Le mois de fin prévisionnel doit suivre le mois de début.' });
    const anneeScolaire = await Establishment.createSchoolYear({ libelle, moisDebut, moisFin });
    return res.status(201).json({ anneeScolaire });
  } catch (error) { next(error); }
};
export const listSchoolYears = async (_req, res, next) => { try { res.json({ annees: await Establishment.listSchoolYears() }); } catch (error) { next(error); } };
export const activateSchoolYear = async (req, res, next) => { try { const anneeScolaire = await Establishment.activateSchoolYear(req.params.id); if (!anneeScolaire) return res.status(404).json({ error: 'Année brouillon introuvable.' }); res.json({ anneeScolaire }); } catch (error) { next(error); } };
export const closeSchoolYear = async (req, res, next) => { try { const anneeScolaire = await Establishment.closeSchoolYear(req.params.id); if (!anneeScolaire) return res.status(404).json({ error: 'Année active introuvable.' }); res.json({ anneeScolaire }); } catch (error) { next(error); } };
export const listYearClasses = async (req, res, next) => { try { res.json({ classes: await Establishment.listYearClasses(req.params.id) }); } catch (error) { next(error); } };

export const createSite = async (req, res, next) => {
  try {
    const { nom } = req.body;
    if (!nom?.trim()) return res.status(400).json({ error: 'Le nom du site est requis.' });
    const site = await Establishment.createSite(req.body);
    return res.status(201).json({ site });
  } catch (error) { next(error); }
};

export const listClasses = async (_req, res, next) => { try { res.json(await AcademicStructure.listAnnualClasses()); } catch (error) { next(error); } };
export const listClassStudents = async (req, res, next) => {
  try {
    const { StudentRegistry } = await import('../models/StudentRegistry.js');
    res.json(await StudentRegistry.listByClass(req.params.classId, await accessScopeFor(req.user)));
  } catch (error) { next(error); }
};
export const listArchivedClassStudents = async (req, res, next) => {
  try {
    const { StudentRegistry } = await import('../models/StudentRegistry.js');
    const data = await StudentRegistry.listByArchivedClass(req.params.classId, await accessScopeFor(req.user));
    if (!data.classInfo) return res.status(404).json({ error: 'Classe archivée introuvable.' });
    res.json(data);
  } catch (error) { next(error); }
};

export const saveFinancialConfiguration = async (req, res, next) => {
  try {
    const { fees = [], plans = [] } = req.body;
    if (!Array.isArray(fees) || !Array.isArray(plans)) return res.status(400).json({ error: 'La configuration financière est invalide.' });
    for (const fee of fees) {
      if (!fee.nom?.trim() || !Number.isFinite(Number(fee.montant)) || Number(fee.montant) < 0) return res.status(400).json({ error: 'Chaque frais doit avoir un nom et un montant valide.' });
      if (!['inscription', 'reinscription', 'les_deux'].includes(fee.applicableA)) return res.status(400).json({ error: 'La règle d’application du frais est invalide.' });
    }
    for (const plan of plans) {
      if (!plan.classeAnnuelleId || !Number.isFinite(Number(plan.montantTotal)) || Number(plan.montantTotal) <= 0) return res.status(400).json({ error: 'Chaque tarif doit avoir un montant strictement positif.' });
      const tranches = plan.tranches || [];
      const totalTranches = tranches.reduce((total, tranche) => total + Number(tranche.montant), 0);
      if (!tranches.length || tranches.some((tranche) => !tranche.nom?.trim() || !tranche.dateEcheance || !Number.isFinite(Number(tranche.montant)) || Number(tranche.montant) <= 0) || Math.round(totalTranches * 100) !== Math.round(Number(plan.montantTotal) * 100)) {
        return res.status(400).json({ error: 'Les tranches doivent être valides et leur total doit correspondre au tarif de la classe.' });
      }
    }
    res.json(await FinancialConfiguration.save(
     { fees, plans },
      await accessScopeFor(req.user),
      req.body.siteId
    ));
  } catch (error) { next(error); }
};
export const getEstablishmentStudents = async (req, res, next) => {
  try {
    const { StudentRegistry } = await import('../models/StudentRegistry.js');
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 10));
    res.json(await StudentRegistry.listForEstablishment(req.query.recherche || '', await accessScopeFor(req.user), page, pageSize));
  } catch (error) { next(error); }
};
