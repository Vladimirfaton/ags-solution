import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
const api = axios.create({
  baseURL: API_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use(
  (config) => {
    const token = sessionStorage.getItem('token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    if (import.meta.env.DEV) config.metadata = { startedAt: performance.now() };
    return config;
  },
  (error) => Promise.reject(error)
);

const OFFLINE_MESSAGE = 'Vous êtes hors ligne ou votre connexion Internet est interrompue. Vérifiez votre connexion, puis réessayez.';
const UNAVAILABLE_MESSAGE = 'La connexion au service est instable ou momentanément interrompue. Vérifiez votre connexion Internet, puis réessayez.';

api.interceptors.response.use(
  (response) => {
    if (import.meta.env.DEV && response.config.metadata?.startedAt) {
      console.debug(`[API] ${response.config.method?.toUpperCase()} ${response.config.url} ${Math.round(performance.now() - response.config.metadata.startedAt)} ms (${response.status})`);
    }
    return response;
  },
  (error) => {
    if (import.meta.env.DEV && error.config?.metadata?.startedAt) {
      console.debug(`[API] ${error.config.method?.toUpperCase()} ${error.config.url} ${Math.round(performance.now() - error.config.metadata.startedAt)} ms (erreur ${error.response?.status || error.code || 'réseau'})`);
    }
    const status = error.response?.status;

    if (status === 503) {
      if (error.response.data) error.response.data.error = UNAVAILABLE_MESSAGE;
    } else if (status >= 500 && error.response?.data) {
      error.response.data.error = 'Une erreur technique est survenue. Réessayez ou contactez l’assistance.';
    } else if (!error.response && error.code !== 'ERR_CANCELED') {
      error.response = { status: 0, data: { error: navigator.onLine === false ? OFFLINE_MESSAGE : UNAVAILABLE_MESSAGE } };
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
  listStudentsByClass: (classId, params = {}) => api.get(`/direction/classes/${classId}/eleves`, { params }),
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
  listStudents: (search = '', page = 1, siteId = null) => api.get('/direction/eleves', { params: { recherche: search, page, pageSize: 10, ...(siteId ? { siteId } : {}) } }),
  studentFinancialDetails: (studentId) => api.get(`/direction/eleves/${studentId}/situation-financiere`),
};

export const secretariatAPI = {
  listClasses: (search = '') => api.get('/secretariat/classes', { params: { recherche: search } }),
  createClass: (data) => api.post('/secretariat/classes', data),
  listStudentsByClass: (classId, params = {}) => api.get(`/secretariat/classes/${classId}/eleves`, { params }),
  updateClassCapacity: (classId, capacite) => api.put(`/secretariat/classes/${classId}/capacite`, { capacite }),
  updateStudent: (id, data) => api.put(`/secretariat/eleves/${id}`, data),
  transferStudent: (id, destinationClassId, motif) => api.post(`/secretariat/eleves/${id}/transfert`, { destinationClassId, motif }),
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
  downloadStudentImportTemplate: () => api.get('/comptabilite/imports/eleves/modele', { responseType: 'blob' }),
  paymentOptions: () => api.get('/comptabilite/paiements/options'),
  createPayment: (data) => api.post('/comptabilite/paiements', data),
  financialConfiguration: () => api.get('/comptabilite/finances'),
  saveFinancialConfiguration: (data) => api.put('/comptabilite/finances', data),
  paymentStatus: (params = {}) => api.get('/comptabilite/paiements/statut', { params }),
  exportPaymentStatus: (params = {}) => api.get('/comptabilite/paiements/statut/export', { params, responseType: 'blob' }),
  paymentHistory: (search = '', page = 1) => api.get('/comptabilite/paiements/historique', { params: { recherche: search, page, pageSize: 10 } }),
  getPaymentReceipt: (id) => api.get(`/comptabilite/paiements/${id}/recu`),
  overdueInstallments: (search = '') => api.get('/comptabilite/paiements/echeances-depassees', { params: { recherche: search } }),
  exportOverdueInstallments: (classe) => api.get('/comptabilite/paiements/echeances-depassees/export', { params: { classe }, responseType: 'blob' }),
    overdueInstallmentsByClass: (classe, search = '', page = 1, pageSize = 5) => api.get('/comptabilite/paiements/echeances-depassees/classe', { params: { classe, recherche: search, page, pageSize } }),
  classesForStudent: (studentId) => api.get(`/comptabilite/inscriptions/eleve/${studentId}/classes`),
};

export const censeurAPI = {
  overview: () => api.get('/censeur/apercu'),
  listClasses: () => api.get('/censeur/classes'),
  listStudentsByClass: (classId, params = {}) => api.get(`/censeur/classes/${classId}/eleves`, { params }),
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

export const assistanceAPI = {
  send: (data) => api.post('/assistance/send', data),
};
export const configAPI = {
  getPricing: () => api.get('/config/pricing'),
};
export default api;
