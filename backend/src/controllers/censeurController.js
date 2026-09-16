import { AcademicMonitoring } from '../models/AcademicMonitoring.js';
import { StudentRegistry } from '../models/StudentRegistry.js';
import { Professor, Subject } from '../models/Professor.js';
import { accessScopeFor } from '../models/AccessScope.js';

export const getOverview = async (req, res, next) => {
 try { res.json(await AcademicMonitoring.overview(await accessScopeFor(req.user))); } catch (error) { next(error); }
};
export const listClasses = async (req, res, next) => {
  try { res.json({ classes: await StudentRegistry.listClasses(await accessScopeFor(req.user)) }); } catch (error) { next(error); }
};
export const listClassStudents = async (req, res, next) => {
  try { res.json(await StudentRegistry.listByClass(req.params.classId, await accessScopeFor(req.user))); } catch (error) { next(error); }
};

export const listSubjects = async (_req, res, next) => {
  try { res.json({ matieres: await Subject.list() }); } catch (error) { next(error); }
};
export const createSubject = async (req, res, next) => {
  try { res.status(201).json({ matiere: await Subject.create(req.body) }); } catch (error) { next(error); }
};
export const updateSubject = async (req, res, next) => {
  try { res.json({ matiere: await Subject.update(req.params.id, req.body) }); } catch (error) { next(error); }
};
export const listProfessors = async (req, res, next) => {
  try { res.json({ professeurs: await Professor.list(await accessScopeFor(req.user)) }); } catch (error) { next(error); }
};
export const createProfessor = async (req, res, next) => {
  try { res.status(201).json({ professeur: await Professor.create(req.body, req.user.id, await accessScopeFor(req.user)) }); } catch (error) { next(error); }
};
export const updateProfessor = async (req, res, next) => {
  try { res.json({ professeur: await Professor.update(req.params.id, req.body, await accessScopeFor(req.user)) }); } catch (error) { next(error); }
};
export const listProfessorAssignments = async (req, res, next) => {
  try { res.json({ affectations: await Professor.assignments(req.params.id, await accessScopeFor(req.user)) }); } catch (error) { next(error); }
};
export const assignProfessor = async (req, res, next) => {
  try { res.status(201).json({ affectation: await Professor.assign({ ...req.body, professorId: req.params.id }, req.user.id, await accessScopeFor(req.user)) }); } catch (error) { next(error); }
};
export const endProfessorAssignment = async (req, res, next) => {
  try { res.json({ affectation: await Professor.endAssignment(req.params.assignmentId, await accessScopeFor(req.user)) }); } catch (error) { next(error); }
};
