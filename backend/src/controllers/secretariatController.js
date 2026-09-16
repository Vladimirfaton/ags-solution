import { StudentRegistry } from '../models/StudentRegistry.js';
import { AcademicStructure } from '../models/AcademicStructure.js';
import { accessScopeFor } from '../models/AccessScope.js';

export const listStudents = async (req, res, next) => {
  try { res.json({ students: await StudentRegistry.list(req.query.recherche || '') }); } catch (error) { next(error); }
};
export const listClasses = async (req, res, next) => {
  try { res.json(await AcademicStructure.listAnnualClasses(await accessScopeFor(req.user))); } catch (error) { next(error); }
};
export const listStudentsByClass = async (req, res, next) => {
  try { res.json(await StudentRegistry.listByClass(req.params.classId, await accessScopeFor(req.user))); } catch (error) { next(error); }
};
export const createClass = async (req, res, next) => {
  try {
    if (!req.body.nom?.trim()) return res.status(400).json({ error: 'Le nom de la classe est requis.' });
    res.status(201).json({ classe: await AcademicStructure.createAnnualClass(req.body, await accessScopeFor(req.user)) });
  } catch (error) { next(error); }
};
export const createStudent = async (req, res, next) => {
  try {
    const { matricule, nom, prenom, annualClassId } = req.body;
    if (!matricule || !nom || !prenom || !annualClassId) return res.status(400).json({ error: 'Matricule, nom, prénom et classe sont requis.' });
    res.status(201).json({
     student: await StudentRegistry.create(
       req.body,
        req.user.id,
        await accessScopeFor(req.user)
      )
   });
  } catch (error) { next(error); }
};
export const updateStudent = async (req, res, next) => {
  try {
    const { nom, prenom } = req.body;
    if (!nom || !prenom) return res.status(400).json({ error: 'Nom et prénom sont requis.' });
    const student = await StudentRegistry.update(req.params.id, req.body, await accessScopeFor(req.user));
    if (!student) return res.status(404).json({ error: 'Élève introuvable.' });
    res.json({ student });
  } catch (error) { next(error); }
};
export const transferStudent = async (req, res, next) => {
  try {
    if (!req.body.destinationClassId) return res.status(400).json({ error: 'La classe de destination est requise.' });
if (!req.body.motif?.trim()) return res.status(400).json({ error: 'Le motif du transfert est requis.' });
    res.json({
     transfer: await StudentRegistry.transfer(
        req.params.id,
        req.body.destinationClassId,
        req.body.motif.trim(),
        req.user.id,
        await accessScopeFor(req.user)
      ),
    });
  } catch (error) { next(error); }
};
