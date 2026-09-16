import { AcademicMonitoring } from '../models/AcademicMonitoring.js';
import { StudentRegistry } from '../models/StudentRegistry.js';
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
