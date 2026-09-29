# PRD: Dashboard Screen

## 1. Overview
The Dashboard is the landing page after a successful login. It displays an overview of the user’s projects, recent activity, and quick‑action shortcuts. Users can navigate to a specific project, create new projects, or view summary statistics.

## 2. User Goals
- Quickly see all owned projects.
- Access recent activity (e.g., recently edited layers/features).
- Initiate creation of a new project.
- Navigate to a project’s detail view.

## 3. UI Layout (Desktop / Mobile)
```
+---------------------------------------------------+
|  Header (logo, user avatar, logout)               |
+---------------------------------------------------+
|  "Your Projects"                                 |
|  +-------------------------------------------+   |
|  |  + Add Project (fab)                       |   |
|  +-------------------------------------------+   |
|                                                   |
|  Project Card Grid (responsive)                    |
|  ┌─────────────────────┐  ┌─────────────────────┐ |
|  │ Project Name         │  │ Project Name         │ |
|  │ • 3 layers           │  │ • 5 layers           │ |
|  │ • 12 features        │  │ • 8 features        │ |
|  │   [Open]             │  │   [Open]             │ |
|  └─────────────────────┘  └─────────────────────┘ |
|                                                   |
|  Recent Activity                                 |
|  ───────────────────────────────────────────────   |
|  • Updated Layer "Roads" (2 h ago)               |
|  • Added Feature "Lake" (1 d ago)                 |
|                                                   |
+---------------------------------------------------+
```
* Project cards are displayed in a responsive grid (2‑column on mobile, up to 4‑column on desktop).
* Each card shows basic stats and a button to open the project.
* A floating action button (`+`) opens the **Create Project** modal.
* Recent activity list is a vertical stack with timestamps.

## 4. Components & Behaviors
| Element | Type | Behavior |
|--------|------|----------|
| Header | Fixed bar | Shows app logo, user avatar (click => Settings), logout button.
| Project Card | Card component | Clicking the card or the "Open" button navigates to `/projects/:id`.
| Add Project FAB | Button (icon‑only) | Opens a modal with the **Create Project** form (see `create-project.md`).
| Recent Activity Item | List item | Shows a short text and a timestamp; clicking may navigate to the related entity.

## 5. Loading & Empty States
* While projects are loading, display skeleton cards.
* If the user has no projects, show an empty‑state illustration with a call‑to‑action button "Create your first project".

## 6. Accessibility
* Keyboard navigation: Tab order follows visual order; Enter on a card opens it.
* All icons have `aria-label` attributes.
* Cards have `role="button"` and appropriate `aria‑pressed` state.

## 7. Analytics
* Track "dashboard_view" with user ID and timestamp.
* Track "project_open" when a card is clicked.
* Track "create_project_click" when the FAB is pressed.

---