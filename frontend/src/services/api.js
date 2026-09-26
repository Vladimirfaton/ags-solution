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
  createSchoolYear: ({ libelle, dateDebut, dateFin }) => api.post('/direction/annees-scolaires', { libelle, moisDebut: dateDebut?.slice(0, 7), moisFin: dateFin?.slice(0, 7) }),
  listYearClasses: (id) => api.get(`/direction/annees-scolaires/${id}/classes`),
  listArchivedClassStudents: (classId) => api.get(`/direction/archives/classes/${classId}/eleves`),
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
  paymentStatus: (params = {}) => api.get('/comptabilite/paiements/statut', { params }),
  exportPaymentStatus: (params = {}) => api.get('/comptabilite/paiements/statut/export', { params, responseType: 'blob' }),
  paymentHistory: (search = '', page = 1) => api.get('/comptabilite/paiements/historique', { params: { recherche: search, page, pageSize: 10 } }),
  getPaymentReceipt: (id) => api.get(`/comptabilite/paiements/${id}/recu`),
  overdueInstallments: (search = '') => api.get('/comptabilite/paiements/echeances-depassees', { params: { recherche: search } }),
  classesForStudent: (studentId) => api.get(`/comptabilite/inscriptions/eleve/${studentId}/classes`),
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

export const cartesAPI = {
  status: () => api.get('/cartes/statut'),
  setStatus: (actif) => api.put('/cartes/statut', { actif }),
  stats: () => api.get('/cartes/stats'),
  preview: (classId) => api.get(`/cartes/classes/${classId}/preview`),
};

export const assistanceAPI = {
  send: (data) => api.post('/assistance/send', data),
};
export const configAPI = {
  getPricing: () => api.get('/config/pricing'),
};
export default api;
