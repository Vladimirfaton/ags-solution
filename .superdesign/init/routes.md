# Routes

Framework: React 18 + React Router 6, Vite.

## `/gestion/tableau-de-bord`
- Component: `frontend/src/pages/ManagementDashboard.jsx`
- Layout: inline responsive management shell
- Roles: `directeur`, `secretaire`, `comptable`, `censeur`
- Purpose: role-aware school management workspace for direction, classes/students, accounting, monitoring, profile, and security.

## `/admin/tableau-de-bord`
- Component: `frontend/src/pages/AdminDashboard.jsx`
- Layout: standalone admin page
- Purpose: technical establishment setup, sites, and management-account overview.

## Authentication routes
- `/gestion` -> `frontend/src/pages/LoginGestion.jsx`
- `/admin` -> `frontend/src/pages/Login.jsx`
- `/admin/verifier` -> `frontend/src/pages/OtpVerification.jsx`
- `/admin/premier-compte` -> `frontend/src/pages/RegisterAdmin.jsx`
- `/reinitialiser-mot-de-passe` -> `frontend/src/pages/ResetPassword.jsx`

## Router source
- `frontend/src/App.jsx`
