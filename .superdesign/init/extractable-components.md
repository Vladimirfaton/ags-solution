# Extractable Components

## ManagementShell
- Source: `frontend/src/pages/ManagementDashboard.jsx`
- Category: layout
- Description: Responsive role-aware sidebar, header, mobile nav, notices, and main content shell.
- Extractable props: `role`, `activeSection`, `onSectionChange`, `onLogout`, `establishmentName`
- Hardcoded: FVS identity mark, labels, Lucide icon choices, Tailwind classes.

## SummaryCard
- Source: `frontend/src/pages/ManagementDashboard.jsx`
- Category: basic
- Description: Compact metric card with icon, label, value, and optional supporting content.
- Extractable props: `icon`, `label`, `value`, `children`
- Hardcoded: white surface, slate border, emerald icon treatment.

## ContentPanel
- Source: `frontend/src/pages/ManagementDashboard.jsx`
- Category: basic
- Description: Section container with title, optional action, and content body.
- Extractable props: `title`, `action`, `children`
- Hardcoded: white surface, border, rounded-xl, padding.

## RoleNavigation
- Source: `frontend/src/pages/ManagementDashboard.jsx`
- Category: layout
- Description: Menu generated from the active management role.
- Extractable props: `role`, `activeSection`, `onSectionChange`
- Hardcoded: menu labels and Lucide icons.
