# CLAUDE.md — shelfwatch-plus (EduManage web app)

Read this first; open other files only when the task needs them.

## The system (3 repos, one product: "EduManage" school management)
- `shelfwatch_sfa_ir_backend` — FastAPI + MySQL/TiDB API (source of truth for rules; has its own CLAUDE.md)
- `shelfwatch-plus` (this) — admin/staff web app: Vite + React 18 + react-router-dom 6 + Tailwind 3, plain JSX (no TS), no state lib
- `work/ShelfwatchPlus` — React Native 0.87 / React 19 / TypeScript Android app for all roles (parents = `student` login; own CLAUDE.md)

## Run
Backend first (`uvicorn app.main:app --reload`), then `npm install && npm run dev` → http://localhost:5173.
API base `VITE_API_URL` (default http://127.0.0.1:8000). Login admin/admin123, principal/principal123, subadmin/sub123.

## Layout
- `src/api.js` — public API surface pages import (re-exports services + file/photo helpers)
- `src/services/http.js` — fetch client: Bearer token, refresh-on-401 (single-flight, Web Locks across tabs), `ApiError{status,detail,requestId,retryAfter,body}`, `apiPage()` for limit/offset + X-Total-Count
- `src/services/session.js` access token in memory, refresh token + user in localStorage · `auth.js`, `users.js`, `userImport.js`, `notifications.js`
- `src/lib/roles.js` (mirrors backend roles: MANAGERS, STAFF, ADMIN_MANAGED, creatableStaffTypes, importableTypes, canManageAccount) · `validators.js` · `format.js` (fmtTime) · `schedule.js` (school-day maths, shared logic with mobile)
- `src/hooks/useApi.js`, `usePagedList.js` (+ `<Pager>`)
- `src/App.jsx` — shell (sidebar/topbar, mobile drawer), role-filtered nav + routes, signed-out routes, forced password change
- `src/components/` — `ui.jsx` (Modal, StatCard, badges, Field, EmailInput, PasswordInput, PhotoPicker, Pager, ErrorBox, DateInput, TimeInput, Toggle), AuthLayout, ChangePasswordForm, CheckInCard, ClassHomework, NotificationBell, SubstituteFinder
- `src/pages/` one file per screen: Login, ForgotPassword, Account, Dashboard, Users, Lessons, UserImport(+user-import/), Classes, SectionPage, StudentPage, MyClasses, LessonPlans, LessonPlanForm, Notices, Notifications, Reception, Fees, FeeClaims, Payments, Attendance, StaffAttendance, Exams, ExamDetail, ExamResults, Transport, BulkSMS, Calendar, Leaves, Substitutions, TeacherTimetable, SchoolTimings, Salary, Reports

## Styling
Palette in `tailwind.config.js` (brand, ok, warn, danger, info, subtle, line, page). Reusable classes via `@apply` in `src/styles.css` (`.card`, `.badge`, `.stat`, `.tabs`, `.pager`, …). Shell uses raw utilities. New screens: use those classes, not inline styles. `:root` CSS vars only for SVG charts.

## Conventions
New backend endpoints may 404/405 → show "needs the latest server update" / fall back (e.g. `/timetable/week` → `/timetable/mine`). Dates `YYYY-MM-DD`, times `HH:MM`, Mon=0. `BACKEND_README.md` = spec for backend work (notifications, substitutions, leave CRUD, school timings, week timetable, class homework) — most of it is now implemented in the backend.

## State
Many uncommitted changes in working tree (`git status`). Last commit: "csv upload, password reset, optimization".
