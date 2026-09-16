# Page Dependency Trees

## `/gestion/tableau-de-bord` Management dashboard
Entry: `frontend/src/pages/ManagementDashboard.jsx`
Dependencies:
- `frontend/src/services/api.js`
- `frontend/src/config/branding.js`
- `frontend/src/utils/paymentReceipt.js`
- `lucide-react`
- local page primitives: `Title`, `Panel`, `Card`, `Input`, `Detail`, `Empty`, `Notice`
- role views: `DirectorHome`, `SecretaryHome`, `ClassRegistry`, `ClassStudents`, `Accountant`, `Enroll`, `FinanceSettings`, `Monitoring`, `Profile`, `Security`, `Sites`

## `/admin/tableau-de-bord` Admin dashboard
Entry: `frontend/src/pages/AdminDashboard.jsx`
Dependencies:
- `frontend/src/services/api.js`
- `frontend/src/config/branding.js`
- `lucide-react`
- local helper: `Field`

## Router
Entry: `frontend/src/App.jsx`
Dependencies:
- auth pages in `frontend/src/pages/`
- `AdminDashboard.jsx`
- `ManagementDashboard.jsx`
