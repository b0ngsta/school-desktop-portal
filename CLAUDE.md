# CLAUDE.md — shelfwatch-plus (EduManage web app)

Read this first; open other files only when the task needs them.

## The system (4 repos, one product: "EduManage" school management)
- `shelfwatch_sfa_ir_backend` — FastAPI + MySQL/TiDB API (source of truth for rules; has its own CLAUDE.md). **Multi-school**: one API, many schools ("organisations"), each with a login code; data never crosses schools (backend `docs/ORGANISATIONS.md`)
- `shelfwatch-plus` (this) — admin/staff web app for ONE school: Vite + React 18 + react-router-dom 6 + Tailwind 3, plain JSX (no TS), no state lib
- `work/ShelfwatchPlus` — React Native 0.87 / React 19 / TypeScript Android app for all roles (parents = `student` login; own CLAUDE.md)
- `work/dashboard` — **EduManage HQ**, the company head's portal over ALL schools (Next.js 16, own CLAUDE.md): creates/renames/switches off schools, resets locked-out accounts, audit log. It uses the API's `/platform/*` endpoints (X-Platform-Secret), never this app's code. A school created there gets a first admin who signs in here with the new school code; set `SCHOOL_APP_URL` in the portal to this app's public URL so new schools are told where to sign in

## Run
Backend first (`uvicorn app.main:app --reload`), then `npm install && npm run dev` → http://localhost:5173.
API base `VITE_API_URL` (default http://127.0.0.1:8000). Login with school code `DEFAULT` (the original school): admin/admin123, principal/principal123, subadmin/sub123. More schools: backend `python -m app.cli create-org CODE "Name"`.

## Layout
- `src/api.js` — public API surface pages import (re-exports services + file/photo helpers)
- `src/services/http.js` — fetch client: Bearer token, refresh-on-401 (single-flight, Web Locks across tabs), `ApiError{status,detail,requestId,retryAfter,body}`, `apiPage()` for limit/offset + X-Total-Count
- `src/services/session.js` access token in memory, refresh token + user (incl. `user.org = {id, code, name}`) in localStorage; last school code in `localStorage.org_code` (kept after sign-out; `getLastOrgCode`) · `auth.js` (`login(username, password, orgCode, captcha?)`, `getCaptcha`, `needsCaptcha`, `lookupSchool(code)`, reset calls take `orgCode` last), `users.js`, `userImport.js`, `notifications.js`
- `src/lib/roles.js` (mirrors backend roles: MANAGERS, STAFF, ADMIN_MANAGED, creatableStaffTypes, importableTypes, canManageAccount) · `validators.js` · `format.js` (fmtTime) · `schedule.js` (school-day maths, shared logic with mobile)
- `src/hooks/useApi.js`, `usePagedList.js` (+ `<Pager>`), `useSchoolName.js` (debounced `GET /organisations/{code}` → idle|found|unknown|error), `useMySections.js` (managers: every class/section/subjects; teachers: assigned ones, `classTeacher` flag)
- `src/App.jsx` — shell (sidebar/topbar with the school's name under "EduManage", mobile drawer), role-filtered nav + routes, signed-out routes, forced password change
- `src/components/` — `ui.jsx` (Modal, StatCard, badges, Field, EmailInput, PasswordInput, PhotoPicker, Pager, ErrorBox, DateInput, TimeInput, Toggle), AuthLayout, SchoolCodeField (school code input + name hint, used by Login and ForgotPassword), ChangePasswordForm, CheckInCard, ClassHomework (+ homework sheet upload), NotificationBell, SubstituteFinder, **Attachment.jsx** (the one picker + viewer for record files: `FileField`, `AttachmentChip`, `FileViewer` modal — images inline, PDFs fetched as a blob because the API sends X-Frame-Options DENY; `fileKind`, `fileProblem` 15 MB check)
- `src/pages/` one file per screen: Login, ForgotPassword, Account, Dashboard, Users, Lessons, UserImport(+user-import/), Classes, SectionPage, StudentPage, MyClasses, LessonPlans, LessonPlanForm, Notices, Notifications, Reception, Fees, FeeClaims, Payments, Attendance, StaffAttendance, Exams, ExamDetail, ExamResults, Transport, BulkSMS, Calendar, Leaves, Substitutions, TeacherTimetable, SchoolTimings, Salary, Reports, SchoolProfile, Announcements, Messages, Events, Documents

## Styling
Palette in `tailwind.config.js` (brand, ok, warn, danger, info, subtle, line, page). Reusable classes via `@apply` in `src/styles.css` (`.card`, `.badge`, `.stat`, `.tabs`, `.pager`, …). Shell uses raw utilities. New screens: use those classes, not inline styles. `:root` CSS vars only for SVG charts.

## Schools (organisations)
Login and ForgotPassword ask for the **school code** (prefilled with the last one) and send `org_code`; usernames are unique per school only. The server scopes every API call to the signed-in user's school, so pages need no school logic. Unknown code → 400 "School code not found…"; disabled school → 403 at login / 401 afterwards. Without a code the server falls back to its `DEFAULT_ORG_CODE`.

## Conventions
New backend endpoints may 404/405 → show "needs the latest server update" / fall back (e.g. `/timetable/week` → `/timetable/mine`). Dates `YYYY-MM-DD`, times `HH:MM`, Mon=0. `BACKEND_README.md` = spec for backend work (notifications, substitutions, leave CRUD, school timings, week timetable, class homework) — most of it is now implemented in the backend.

## Student-portal inputs (Oct 2026, backend migration 0011) — what feeds the parent app
- `/settings/school` **SchoolProfile** (managers read, admin/principal edit; logo upload) · `/announcements` **Announcements** (managers; launch popup in the parent app: title, message, ≤5 photos, show from/until, on/off) · `/messages` **Messages** (managers: section / some students / class / all; class teachers: own section or its students; read receipts) · `/documents` **Documents** (tabs Timetables / Syllabus; managers anything, class teacher → timetable for own section, teacher → syllabus of a class they teach) · `/events` **Events** (managers edit, staff view; photos + video links).
- Changed: Notices (any manager posts; optional PDF/photo), ClassHomework (sheet on create / edit, remove), Transport (vehicle type, driver account, shift; "N students" → riders modal with stop, pickup, drop), Attendance (Half day button), Users (teacher Designation).
- Verified with Playwright against a local API (every new page, uploads, 390 px). `npx vite build` clean.

## Review fixes (late Oct 2026, backend migrations 0013–0016)
- **People leave, nothing is deleted**: `components/LeaveActions.jsx` (`LeftBadge`, `LeaveModal` → `DELETE /users|students/{id}?reason=` which now marks the account as left and keeps every record, `reactivate(person)` → `POST …/reactivate` + a message for `needs_class` / `roll_no_cleared` / back in section). Users page: "Show" select Current / Left / Everyone (`?status=active|left|all`), "Mark as left" / "Reactivate" buttons. StudentPage: left banner (last class/section), managers get Mark as left / ↩ Reactivate, editing hidden while left.
- **Sign-in**: `services/session.js` `getDeviceId()` (localStorage `device_id`, kept after sign-out) → `X-Device-Id` on every request (`http.js`); `auth.js` `login(username, password, orgCode, captcha)` sends `captcha_supported: true`, `needsCaptcha(err)` (428 + `code`), `getCaptcha()` (`POST /auth/captcha`, public). Login shows the picture + "↻ New picture" + "N characters" input after repeated failures; a fresh picture after every try.
- **Fees page is paged**: `usePagedList` + `<Pager>` for `/fees` (50), `/fees/pending-students` (20), `/fees/claims` (20); stats separately. Student pickers use `components/StudentSearch.jsx` (debounced `GET /students?q=&limit=20`) instead of loading every student (Fees, Payments).
- **Exam results per subject**: ExamResults has subject tabs ("Whole exam" + the class's subjects, role=tab), an "Out of" maximum, client check "Marks must be between 0 and …"; saves `subject` + `max_marks`. Exams form has an optional maximum.
- Notification bell polling skips while the tab is hidden.
- Verified with Playwright against a local API (sign-in CAPTCHA, fees paging + student search, mark left / reactivate, subject marks, 390 px); `npx vite build` clean.
- Regression smoke (26 Oct 2026): every page opened as admin (32 routes) and as a teacher (23) — new build AND the previous build, both against the new API: no crashes, console errors, 5xx or error boxes. So an older deployed web build keeps working after the backend update (its "Delete" now marks the person as left).

### Open issues (26 Oct 2026, not fixed yet)
- Notices, Lesson plans, Reception (enquiries) and Transport still load their whole list; Bulk SMS history shows only the latest 100 (API default) — move them to `usePagedList` + `<Pager>` like Fees.
- Deleting a class / section (Classes page), an exam (Exams) or a fee (Fees, even a paid one) still hard-deletes history on the server — see the backend CLAUDE.md "Open issues".
- No automated tests in this repo (checks are Playwright scripts run by hand).

## Nov 2026 (backend: no migration; see its CLAUDE.md "Nov 2026 session")
- **Documents → Syllabus**: "What is in the file?" One subject / **Full syllabus (all subjects)** (sends `subject=""`); list shows a blue "Full syllabus" badge. Parents see it under "Full Syllabus" in the app.
- **StudentPage → Remarks**: Edit (inline textarea → `PUT /students/{id}/remarks/{rid}`) and Delete, shown only to the remark's author or managers (the server enforces the same).
- **ExamResults**: new card per section (`ResultsUpload`): "All subjects" table from `GET /exams/{id}/results/sheet` (marks per subject, AB, total, %), and for the class teacher / managers (`can_import`) ⬇️ Download **Excel** template (.xlsx via `fetchFile` + `saveBlob`) + a **required "Maximum marks per subject"** field (prefilled from the max in use / the exam's) + ⬆️ Upload results (.xlsx only; `POST …/results/import` with `max_marks`; on 400 the `errors` rows are listed; nothing saved). A successful upload publishes the results (message says so). Hidden on an older server (sheet 404). The per-subject entry below is unchanged and reloads after an upload.
- **User import is Excel**: template / export download as .xlsx (server), the file input takes .xlsx (CSV still accepted), texts/buttons say "Import from Excel" (Users, SectionPage, UserImport, ImportTips, ColumnHelp). The error-report download is still a CSV.
- `npx vite build` clean. Not yet clicked through with Playwright against a live API.

## State
Many uncommitted changes in working tree (`git status`). Last commit: "csv upload, password reset, optimization". Latest uncommitted work: school code on sign-in/forgot-password (multi-school backend), then the student-portal inputs above.
