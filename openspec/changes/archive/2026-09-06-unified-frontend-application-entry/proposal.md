## Why

While all individual React components (`RepositoryPicker`, `FleetDashboard`, `RepositoryDashboard`, `DarkTerminal`) have been created, there is currently no root application entry point (`index.html`, `main.tsx`, `App.tsx`), development server script, or production static hosting in Express. Users cannot launch or interact with the frontend in a browser.

## What Changes

- **Root HTML & Entry Point**: Provide `index.html` with Tailwind CSS styling and `src/frontend/main.tsx` mounting to `#root`.
- **Unified Single-Page App (`src/frontend/App.tsx`)**:
  - Top navigation bar showing authenticated user profile and team switcher.
  - View switcher between Fleet Build Health and Team Repositories.
  - Interactive drill-down: clicking a repository opens its 4-step pipeline status, real-time resource gauges, and live build terminal.
- **Vite Tooling & API Proxying**: Add `vite.config.ts` with proxy to `http://localhost:3000` and add `"dev": "vite"` and `"build:client": "vite build"` scripts.
- **Unified Production Serving**: In `src/backend/app.ts`, serve static production assets from `dist/client` (or fallback) so the full app runs on a single port.

## Capabilities

### Modified Capabilities
- `observability-dashboards`: Provides an integrated browser application hosting fleet telemetry, repository dashboards, and terminal streaming.
- `scoped-repository-picker`: Integrates the interactive picker into the top-level application workflow.

## Impact

- `index.html`: Web application HTML shell.
- `src/frontend/main.tsx`: React DOM mount.
- `src/frontend/App.tsx`: Unified single-page application component.
- `vite.config.ts`: Vite dev server configuration and API proxy.
- `package.json`: Added `"dev"` and `"build:client"` scripts.
- `src/backend/app.ts`: Static asset middleware serving built frontend.
- `Dockerfile`: Compiles client bundle during build stage.
