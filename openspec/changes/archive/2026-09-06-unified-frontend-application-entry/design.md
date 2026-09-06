## Context

See proposal.md - Why.
The platform has four robust React frontend components (`RepositoryPicker`, `FleetDashboard`, `RepositoryDashboard`, and `DarkTerminal`), but lacks:
- A root HTML document (`index.html`)
- An entry mount file (`src/frontend/main.tsx`)
- A cohesive shell component (`src/frontend/App.tsx`) uniting these views
- A dev server setup (`vite.config.ts` + npm script) with backend API proxying
- Express static asset hosting in production

## Goals / Non-Goals

**Goals:**
- Provide `index.html` loading Tailwind CSS and mounting `#root`.
- Implement `src/frontend/main.tsx` using `react-dom/client`.
- Implement `src/frontend/App.tsx` providing:
  - Top navigation bar with user profile, team selector, and view tabs (Fleet Health, Repositories).
  - Full integration of `FleetDashboard`.
  - Repository picker view that allows drilling into `RepositoryDashboard` and live `DarkTerminal`.
- Add `vite.config.ts` with proxy rules forwarding `/api` requests to backend port 3000.
- Update `package.json` with `"dev"` (`vite`) and `"build:client"` (`vite build`).
- Update `src/backend/app.ts` to statically serve client assets in production if `dist/client` exists.

**Non-Goals:**
- Complex client-side routing libraries (e.g. react-router-dom) — state-based navigation keeps bundle minimal and avoids extra dependencies.
- Authentication login screen redesign — user context is passed as props or mock session.

## Decisions

### 1. State-Based View Switcher in App.tsx
- **Choice**: Use React state (`activeTab: 'fleet' | 'repos'`, `selectedRepo: Repo | null`, `currentTeam: Team`) to drive navigation.
- **Rationale**: Keeps bundle dependencies lean, avoids router version conflicts, and seamlessly bridges the picker, repository dashboard, and dark terminal.

### 2. Vite Dev Server with API Proxy
- **Choice**: Use Vite (already present in `node_modules`) on port 5173 with proxy targeting `http://localhost:3000` for `/api`.
- **Rationale**: Instant hot module replacement (HMR) during local development without CORS complications.

### 3. Production Static Serving in Express App
- **Choice**: In `src/backend/app.ts`, serve `dist/client` via `express.static` with SPA fallback to `index.html` when in production or when `dist/client` exists.
- **Rationale**: Allows the single Docker container / Kubernetes deployment to host both the API and UI seamlessly on port 3000.

## Risks / Trade-offs

- [Static asset path resolution] → Ensure `dist/client` check is robust and does not intercept `/api` routes by placing static middleware after API route registrations.
