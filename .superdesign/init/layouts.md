# Shared Layouts

The frontend has no standalone layout component. The management shell is rendered inline by `frontend/src/pages/ManagementDashboard.jsx`.

## Management shell
- Source: `frontend/src/pages/ManagementDashboard.jsx`
- Description: Responsive application shell with a desktop sidebar, sticky header, mobile navigation, role-specific menu, content area, notices, profile and security sections.
- Key visual details: white sidebar and header, `#f7faf8` page background, emerald active state, slate typography, Lucide icons, Tailwind utility classes.

```jsx
// Full shell source lives in frontend/src/pages/ManagementDashboard.jsx.
// The render branch begins after role content is computed and includes the sidebar,
// sticky header, mobile nav, notices, and main content wrapper.
```
