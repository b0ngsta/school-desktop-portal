# EduManage — React Frontend (v2)

Vite + React 18 + react-router + **Tailwind CSS v3**. Modern responsive UI (mobile drawer sidebar). API base: `http://127.0.0.1:8000` (override with `VITE_API_URL`).

Styling approach: the app shell (sidebar, topbar, login, modals) uses raw Tailwind utility classes in JSX. Reusable design-system pieces (`card`, `badge`, `stat`, `tabs`, buttons, tables…) are Tailwind-composed component classes in `src/styles.css` via `@apply` — one place to retheme everything. `:root` CSS variables remain only for inline-styled SVG charts. Palette lives in `tailwind.config.js` (`brand`, `ok`, `warn`, `danger`, `info`, `subtle`, `line`, `page`).

## Run

```bash
# backend first (shelfwatch_sfa_ir_backend): uvicorn app.main:app --reload
npm install
npm run dev
```

Open **http://localhost:5173** → login `admin` / `admin123` (also `principal`/`principal123`, `subadmin`/`sub123`).

## Structure

- `src/api.js` — public API surface the pages import (re-exports the services below + file/photo helpers)
- `src/services/` — talking to the backend
  - `http.js` — fetch client: Bearer token, **refresh on 401** (single-flight, shared across tabs via Web Locks),
    `ApiError` (`status`, `detail`, `requestId`, `retryAfter`, `body`), `apiPage()` for `limit/offset` + `X-Total-Count`
  - `session.js` — access token (memory), refresh token + user (localStorage), change events (`subscribe`)
  - `auth.js` — login, logout, logout-all, change password, forgot/verify/reset password
  - `users.js` — `PUT /users/{id}`, photo upload, principal lookup
  - `userImport.js` — CSV import: columns, template, export, preview/save
- `src/lib/` — no-React helpers: `roles.js` (who may do what), `validators.js` (email/password rules), `format.js`
- `src/hooks/usePagedList.js` — one page of a paginated endpoint + `<Pager>` from `ui.jsx`
- `src/App.jsx` — shell (sidebar/topbar), role-filtered nav + routes, signed-out routes, forced password change
- `src/components/` — `ui.jsx` (Modal, StatCard, badges, Field, EmailInput, PasswordInput, PhotoPicker, Pager, ErrorBox),
  `AuthLayout.jsx` (card used by all signed-out screens), `ChangePasswordForm.jsx`
- `src/pages/` — one file per screen:
  - `Login`, `ForgotPassword` (username/email → 6-digit code → new password), `Account` (change password, sign out everywhere)
  - `UserImport` (+ `user-import/`) — CSV bulk add/edit: type & section → template/export → upload (+ photos ZIP) → preview → save → error report
  - `Dashboard` (role-aware stats + latest notices)
  - `Users` (staff CRUD, teacher info, class **assignments** modal)
  - `Classes` (class/section cards → section page)
  - `SectionPage` (student list + add-student; teachers see "Add lesson plan" if assigned)
  - `StudentPage` (profile + tabs: Homework / Report Cards / Remarks) — shared by all roles
  - `MyClasses` (teacher's assignments)
  - `LessonPlans` (managers: teacher list → plans by class; teacher: own plans)
  - `LessonPlanForm` (heading, duration range, drag-drop files, final remark)
  - `Notices`
  - `Reception` (enquiry pipeline + stats), `Fees` (records, mark-paid → auto transaction),
    `Attendance` (section sheet, one-tap P/A/L, teachers mark own class), `Exams` (schedule + publish results),
    `Transport` (vehicles/routes), `BulkSMS` (groups + templates, simulated send), `Payments` (transaction history + stats)

## Auth notes

- Access tokens live in memory only; a page reload gets a new one from `/auth/refresh` with the stored refresh token.
- A `401` triggers one refresh and a retry; only a `401` from `/auth/refresh` signs the user out (network/5xx keep the session).
- `must_change_password` (seeded accounts, CSV-imported users) shows a "choose a new password" screen before the app.
- With the refresh flow shipped, the backend can lower `ACCESS_TOKEN_EXPIRE_MINUTES` to 15 and set `ENFORCE_PASSWORD_CHANGE=true`.
  Email is required on every add/edit form, so `REQUIRE_USER_EMAIL=true` can be turned on too.

## Restyling

All shared look-and-feel is in `tailwind.config.js` (palette) and the `@layer components` classes in `src/styles.css`
(`.card`, `.badge`, `.auth-card`, `.notice`, `.chip-btn`, `.pager`, …). New screens use those classes rather than inline styles,
so a redesign can mostly happen in those two files plus `AuthLayout.jsx` and the shell in `App.jsx`.

## Suggested first-run flow

1. As `subadmin`: Classes → add "Class 5" + Section A → Users → add a teacher → Assignments → make them class teacher of Class 5-A.
2. Open Class 5-A → add a student.
3. Log in as the teacher: My Classes → open 5-A → add homework/report card, or "Add lesson plan".
4. Log in as `admin`/`principal`: Lesson Plans → click the teacher. 👀
