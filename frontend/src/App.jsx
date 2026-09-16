import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import axios from 'axios';

// Pages admin
import Login from './pages/Login';
import RegisterAdmin from './pages/RegisterAdmin';
import ResetPassword from './pages/ResetPassword';
import OtpVerification from './pages/OtpVerification';
import AdminDashboard from './pages/AdminDashboard';

// Pages espace gestion (directeur / secrétaire)
import LoginGestion from './pages/LoginGestion';
import ManagementDashboard from './pages/ManagementDashboard';

const API_URL = import.meta.env.VITE_API_URL;
axios.defaults.baseURL = API_URL;

const getStoredUser = () => {
  try {
    return JSON.parse(sessionStorage.getItem('user') || 'null');
  } catch {
    return null;
  }
};

// allowedRoles optionnel : si fourni, restreint la route aux rôles listés
// et redirige vers le bon dashboard sinon (jamais un 403 silencieux côté UI).
const PrivateRoute = ({ children, isAuthenticated, loading, allowedRoles, loginPath = '/gestion' }) => {
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#f7faf8]">
        <div className="flex items-center gap-2 text-slate-400">
          <div className="w-5 h-5 border-2 border-slate-200 border-t-emerald-600 rounded-full animate-spin" />
          <span className="text-sm">Chargement</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return <Navigate to={loginPath} />;

  if (allowedRoles) {
    const user = getStoredUser();
    if (!user || !allowedRoles.includes(user.role)) {
      const fallback = user?.role === 'admin' ? '/admin/tableau-de-bord' : '/gestion/tableau-de-bord';
      return <Navigate to={fallback} />;
    }
  }

  return children;
};

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const verifyToken = async () => {
      const token = sessionStorage.getItem('token');
      if (token) {
        try {
          await axios.get(`${API_URL}/auth/verify`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          setIsAuthenticated(true);
        } catch (err) {
          console.error('Token verification failed:', err);
          sessionStorage.removeItem('token');
          sessionStorage.removeItem('user');
          setIsAuthenticated(false);
        }
      }
      setLoading(false);
    };

    verifyToken();
  }, []);

  const handleLogout = () => {
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');
    setIsAuthenticated(false);
  };

  const storedUser = getStoredUser();
  const homeRedirect = !isAuthenticated
    ? '/gestion'
    : storedUser?.role === 'admin'
      ? '/admin/tableau-de-bord'
      : '/gestion/tableau-de-bord';

  return (
    <Router>
      <Routes>
        {/* --- Admin --- */}
        <Route
          path="/admin"
          element={
            isAuthenticated ? (
              <Navigate to={homeRedirect} />
            ) : (
              <Login onLoginSuccess={() => setIsAuthenticated(true)} />
            )
          }
        />
        <Route
          path="/admin/verifier"
          element={<OtpVerification onLoginSuccess={() => setIsAuthenticated(true)} />}
        />
        <Route path="/admin/premier-compte" element={<RegisterAdmin onLoginSuccess={() => setIsAuthenticated(true)} />} />
        <Route path="/reinitialiser-mot-de-passe" element={<ResetPassword />} />
        <Route
          path="/admin/tableau-de-bord"
          element={
            <PrivateRoute isAuthenticated={isAuthenticated} loading={loading} allowedRoles={['admin']} loginPath="/admin">
              <AdminDashboard onLogout={handleLogout} />
            </PrivateRoute>
          }
        />

        {/* --- Espace gestion (directeur / secrétaire) --- */}
        <Route
          path="/gestion"
          element={
            isAuthenticated ? (
              <Navigate to={homeRedirect} />
            ) : (
              <LoginGestion onLoginSuccess={() => setIsAuthenticated(true)} />
            )
          }
        />
        <Route
          path="/gestion/tableau-de-bord"
          element={
            <PrivateRoute
              isAuthenticated={isAuthenticated}
              loading={loading}
              allowedRoles={['directeur', 'secretaire', 'comptable', 'censeur']}
              loginPath="/gestion"
            >
              <ManagementDashboard onLogout={handleLogout} />
            </PrivateRoute>
          }
        />

        {/* Default redirect */}
        <Route path="/" element={<Navigate to={homeRedirect} />} />
        <Route path="/login" element={<Navigate to="/admin" replace />} />
        <Route path="/verify-otp" element={<Navigate to="/admin" replace />} />
        <Route path="/dashboard" element={<Navigate to="/admin/tableau-de-bord" replace />} />
        <Route path="/gestion/login" element={<Navigate to="/gestion" replace />} />
        <Route path="/gestion/dashboard" element={<Navigate to="/gestion/tableau-de-bord" replace />} />
        <Route path="*" element={<Navigate to={homeRedirect} />} />
      </Routes>
    </Router>
  );
}

export default App;
