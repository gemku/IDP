## 1. Web Shell and Entry Point

- [x] 1.1 Create `index.html` loading Tailwind CSS and mounting `#root`
- [x] 1.2 Create `src/frontend/main.tsx` mounting root React application
- [x] 1.3 Create `src/frontend/App.tsx` uniting `FleetDashboard`, `RepositoryPicker`, `RepositoryDashboard`, and `DarkTerminal` with navigation tabs and team selector

## 2. Dev Server and Build Tooling

- [x] 2.1 Create `vite.config.ts` configuring port 5173 and proxying `/api` requests to `http://localhost:3000`
- [x] 2.2 Update `package.json` with `"dev": "vite"` and `"build:client": "vite build"` scripts

## 3. Production Serving & Verification

- [x] 3.1 Update `src/backend/app.ts` to serve client build assets statically when available
- [x] 3.2 Add automated test validating frontend entry points, build script, and static serving
- [x] 3.3 Verify build with `npx tsc --noEmit` and run full test suite with `npm test`
