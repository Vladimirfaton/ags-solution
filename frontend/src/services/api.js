import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
export const FILE_BASE_URL = API_URL.replace(/\/api\/?$/, '');
const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use(
  (config) => {
    const token = sessionStorage.getItem('token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;

    // Les détails d'une erreur 500 restent exclusivement dans les journaux du
    // serveur. L'interface ne reçoit qu'un message compréhensible et sûr.
    if (status >= 500 && error.response?.data) {
      error.response.data.error = 'Une erreur technique est survenue. Réessayez ou contactez l’assistance.';
    }

    if (status === 401) {
      const isOnGestionPage = window.location.pathname.startsWith('/gestion');
      const isLoginAttempt = error.config?.url?.includes('/auth/login');

      if (!isLoginAttempt) {
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('user');
        window.location.href = isOnGestionPage ? '/gestion' : '/admin';
      }
    }
    return Promise.reject(error);
  }
);

export const authAPI = {
  bootstrapStatus: () => api.get('/auth/bootstrap-status'),
  login: (email, password) => api.post('/auth/login', { email, password }),
  register: (email, password, confirmPassword) =>
    api.post('/auth/register', { email, password, confirmPassword }),
  verify: () => api.get('/auth/verify'),
  verifyOtp: (email, otpCode) => api.post('/auth/verify-otp', { email, otpCode }),
  resendOtp: (email) => api.post('/auth/resend-otp', { email }),

  // Comptes de gestion (directeur/secrétaire)
  loginGestion: (username, password) => api.post('/auth/login-gestion', { username, password }),
  requestPasswordReset: (username) => api.post('/auth/mot-de-passe-oublie', { username }),
  resetPassword: (token, password, confirmPassword) => api.post('/auth/reinitialiser-mot-de-passe', { token, password, confirmPassword }),
  getMyProfile: () => api.get('/auth/mon-profil'),
  updateMyProfile: (data) => api.put('/auth/mon-profil', data),
  changeMyPassword: (data) => api.put('/auth/mon-mot-de-passe', data),
};

export const platformAPI = {
  setupStatus: () => api.get('/platform/setup-status'),
  getEstablishment: () => api.get('/platform/etablissement'),
  overview: () => api.get('/platform/apercu'),
  initialize: (data) => api.post('/platform/initialisation', data),
  createSite: (data) => api.post('/platform/sites', data),
};

export const directionAPI = {
  overview: () => api.get('/direction/apercu'),
  listStudentsByClass: (classId) => api.get(`/direction/classes/${classId}/eleves`),
  createFirstSchoolYear: async ({ libelle, dateDebut, dateFin }) => {
    const { data } = await api.post('/direction/annees-scolaires', {
      libelle,
      moisDebut: dateDebut?.slice(0, 7),
      moisFin: dateFin?.slice(0, 7),
    });
    return api.post(`/direction/annees-scolaires/${data.anneeScolaire.id}/activer`);
  },
  listSchoolYears: () => api.get('/direction/annees-scolaires'),
  activateSchoolYear: (id) => api.post(`/direction/annees-scolaires/${id}/activer`),
  closeSchoolYear: (id) => api.post(`/direction/annees-scolaires/${id}/cloturer`),
listStudents: (search = '', page = 1) => api.get('/direction/eleves', { params: { recherche: search, page, pageSize: 10 } }),
};

export const secretariatAPI = {
  listClasses: () => api.get('/secretariat/classes'),
  createClass: (data) => api.post('/secretariat/classes', data),
  listStudentsByClass: (classId) => api.get(`/secretariat/classes/${classId}/eleves`),
  updateStudent: (id, data) => api.put(`/secretariat/eleves/${id}`, data),
  transferStudent: (id, destinationClassId) => api.post(`/secretariat/eleves/${id}/transfert`, { destinationClassId }),
};

export const comptabiliteAPI = {
  cashOverview: () => api.get('/comptabilite/caisse'),
  enrollmentOptions: () => api.get('/comptabilite/inscriptions/options'),
  createEnrollment: (data) => api.post('/comptabilite/inscriptions', data),
  previewStudentImport: (file, siteId) => {
    const formData = new FormData();
    formData.append('file', file);
    if (siteId) formData.append('siteId', siteId);
    return api.post('/comptabilite/imports/eleves/apercu', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
  confirmStudentImport: (file, siteId) => {
    const formData = new FormData();
    formData.append('file', file);
    if (siteId) formData.append('siteId', siteId);
    return api.post('/comptabilite/imports/eleves/confirmer', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
  paymentOptions: () => api.get('/comptabilite/paiements/options'),
  createPayment: (data) => api.post('/comptabilite/paiements', data),
  financialConfiguration: () => api.get('/comptabilite/finances'),
  saveFinancialConfiguration: (data) => api.put('/comptabilite/finances', data),
};

export const censeurAPI = {
  overview: () => api.get('/censeur/apercu'),
  listClasses: () => api.get('/censeur/classes'),
  listStudentsByClass: (classId) => api.get(`/censeur/classes/${classId}/eleves`),
  listSubjects: () => api.get('/censeur/matieres'),
  createSubject: (data) => api.post('/censeur/matieres', data),
  updateSubject: (id, data) => api.put(`/censeur/matieres/${id}`, data),
  listProfessors: () => api.get('/censeur/professeurs'),
  createProfessor: (data) => api.post('/censeur/professeurs', data),
  updateProfessor: (id, data) => api.put(`/censeur/professeurs/${id}`, data),
  listAssignments: (id) => api.get(`/censeur/professeurs/${id}/affectations`),
  assignProfessor: (id, data) => api.post(`/censeur/professeurs/${id}/affectations`, data),
  endAssignment: (id) => api.put(`/censeur/affectations/${id}/terminer`),
};

export const collegeAPI = {
  getAll: () => api.get('/colleges'),
  getByCommune: (commune, departement) =>
    api.get('/colleges/commune', { params: { commune, departement } }),
  getById: (id) => api.get(`/colleges/${id}`),
  create: (data) => api.post('/colleges', data),
  update: (id, data) => api.put(`/colleges/${id}`, data),
  delete: (id) => api.delete(`/colleges/${id}`),
  uploadSignature: (id, file) => {
    const formData = new FormData();
    formData.append('signature', file);
    return api.post(`/colleges/${id}/signature`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  getStats: (id) => api.get(`/colleges/${id}/stats`),
  notifierBrouillon: (id, classeId = null) =>
  api.post(`/colleges/${id}/notifier-brouillon`, { classe_id: classeId }),
  getNotificationsBrouillon: (id) =>
  api.get(`/colleges/${id}/notifications-brouillon`),
    notifierCartes: (id, { classeId = null, datePassage }) =>
    api.post(`/colleges/${id}/notifier-cartes`, { classe_id: classeId, date_passage: datePassage }),
  getNotificationsCartes: (id) =>
    api.get(`/colleges/${id}/notifications-cartes`),
  // Comptes de gestion
  createManagementAccounts: (id, data) => api.post(`/colleges/${id}/comptes-gestion`, data),
  getManagementAccounts: (id) => api.get(`/colleges/${id}/comptes-gestion`),
  resendManagementActivationEmails: (id) => api.post(`/colleges/${id}/comptes-gestion/resend`),
};

export const classAPI = {
  getByCollege: (collegeId) => api.get(`/classes/${collegeId}/classes`),
  getById: (classId) => api.get(`/classes/class/${classId}`),
  create: (collegeId, data) => api.post(`/classes/${collegeId}/classes`, data),
  update: (classId, data) => api.put(`/classes/class/${classId}`, data),
  delete: (classId) => api.delete(`/classes/class/${classId}`),
  // Observations
  listObservations: (classId) => api.get(`/classes/class/${classId}/observations`),
  createObservation: (classId, contenu, eleveId = null) => 
  api.post(`/classes/class/${classId}/observations`, { contenu, eleve_id: eleveId }),
  deleteObservation: (classId, observationId) =>
  api.delete(`/classes/class/${classId}/observations/${observationId}`),
};
export const observationAPI = {
  getUnread: () => api.get('/observations/non-lues'),
  markAsRead: () => api.put('/observations/marquer-lues'),
};
export const studentAPI = {
  getByClass: (classId) => api.get(`/students/class/${classId}`),
  getByCollege: (collegeId) => api.get(`/students/college/${collegeId}`),
  getById: (studentId) => api.get(`/students/${studentId}`),
  create: (classId, data, photo) => {
    const formData = new FormData();
    Object.keys(data).forEach((k) => formData.append(k, data[k]));
    if (photo) formData.append('photo', photo);
    return api.post(`/students/${classId}/students`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  update: (studentId, data) => api.put(`/students/${studentId}`, data),
  updatePhoto: (studentId, photo) => {
    const formData = new FormData();
    formData.append('photo', photo);
    return api.put(`/students/${studentId}/photo`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  delete: (studentId) => api.delete(`/students/${studentId}`),
};

export const importAPI = {
  validateExcel: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/students/import/validate', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  importStudents: (classId, students) => api.post(`/students/${classId}/import`, { students }),
  downloadTemplate: () => api.get('/students/import/template', { responseType: 'blob' }),
};
export const assistanceAPI = {
  send: (data) => api.post('/assistance/send', data),
};
export const configAPI = {
  getPricing: () => api.get('/config/pricing'),
};
export default api;
