import React, { useEffect, useState } from 'react'
import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import AuthLayout from './components/AuthLayout.jsx'
import ChangePasswordForm from './components/ChangePasswordForm.jsx'
import { MANAGERS, importableTypes, roleLabel } from './lib/roles.js'
import { logout } from './services/auth.js'
import { installResumeRefresh } from './services/http.js'
import { getUser, subscribe } from './services/session.js'
import Login from './pages/Login.jsx'
import ForgotPassword from './pages/ForgotPassword.jsx'
import Account from './pages/Account.jsx'
import UserImport from './pages/UserImport.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Users from './pages/Users.jsx'
import Classes from './pages/Classes.jsx'
import SectionPage from './pages/SectionPage.jsx'
import StudentPage from './pages/StudentPage.jsx'
import MyClasses from './pages/MyClasses.jsx'
import LessonPlanForm from './pages/LessonPlanForm.jsx'
import LessonPlans from './pages/LessonPlans.jsx'
import Notices from './pages/Notices.jsx'
import Reception from './pages/Reception.jsx'
import Fees from './pages/Fees.jsx'
import Attendance from './pages/Attendance.jsx'
import Exams from './pages/Exams.jsx'
import Calendar from './pages/Calendar.jsx'
import ExamDetail from './pages/ExamDetail.jsx'
import ExamResults from './pages/ExamResults.jsx'
import TeacherTimetable from './pages/TeacherTimetable.jsx'
import Transport from './pages/Transport.jsx'
import BulkSMS from './pages/BulkSMS.jsx'
import Payments from './pages/Payments.jsx'

const ALL_STAFF = [...MANAGERS, 'teacher']
const WITH_DRIVER = [...ALL_STAFF, 'driver']

const NAV = [
  { to: '/', label: 'Dashboard', icon: '📊', roles: ALL_STAFF },
  { to: '/reception', label: 'Reception', icon: '🛎️', roles: MANAGERS },
  { to: '/fees', label: 'Fees', icon: '💰', roles: MANAGERS },
  { to: '/users', label: 'Users', icon: '👥', roles: MANAGERS },
  { to: '/classes', label: 'Classes', icon: '🏫', roles: MANAGERS },
  { to: '/my-classes', label: 'My Classes', icon: '🏫', roles: ['teacher'] },
  { to: '/my-timetable', label: 'My Timetable', icon: '🗓️', roles: ['teacher'] },
  { to: '/attendance', label: 'Attendance', icon: '✅', roles: ALL_STAFF },
  { to: '/exams', label: 'Exams', icon: '📝', roles: ALL_STAFF },
  { to: '/calendar', label: 'Calendar', icon: '📅', roles: ALL_STAFF },
  { to: '/lesson-plans', label: 'Lesson Plans', icon: '📚', roles: ALL_STAFF },
  { to: '/transport', label: 'Transport', icon: '🚌', roles: [...MANAGERS, 'driver'] },
  { to: '/sms', label: 'Bulk SMS', icon: '💬', roles: MANAGERS },
  { to: '/payments', label: 'Payments', icon: '💳', roles: MANAGERS },
  { to: '/notices', label: 'Notices', icon: '📣', roles: WITH_DRIVER },
]

const TITLES = {
  '/': 'Dashboard',
  '/reception': 'Reception',
  '/fees': 'Fees',
  '/users': 'Users',
  '/classes': 'Classes',
  '/my-classes': 'My Classes',
  '/my-timetable': 'My Timetable',
  '/attendance': 'Attendance',
  '/exams': 'Exams',
  '/calendar': 'Calendar',
  '/lesson-plans': 'Lesson Plans',
  '/transport': 'Transport',
  '/sms': 'Bulk SMS',
  '/payments': 'Payments',
  '/notices': 'Notices',
  '/account': 'My account',
  '/users/import': 'Import users',
}

/** Keeps React in sync with the session (sign-in/out, other tabs, expiry). */
function useSessionUser() {
  const [user, setUser] = useState(getUser)
  useEffect(() => subscribe((e) => {
    if (e.type === 'signed-out') setUser(null)
    else if (e.type === 'user') setUser(e.user)
    else if (e.type === 'password-change-required') setUser(getUser())
  }), [])
  useEffect(installResumeRefresh, [])
  return [user, setUser]
}

export default function App() {
  const [user, setUser] = useSessionUser()
  const [navOpen, setNavOpen] = useState(false)
  const location = useLocation()

  // close the mobile drawer on navigation
  useEffect(() => setNavOpen(false), [location.pathname])

  if (!user) {
    return (
      <Routes>
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="*" element={<Login onLogin={setUser} />} />
      </Routes>
    )
  }

  if (user.must_change_password) {
    return (
      <AuthLayout
        title="Choose a new password"
        subtitle={`Hi ${user.full_name}, please set your own password before continuing.`}
        footer={<button className="link" onClick={logout}>Log out</button>}
      >
        <ChangePasswordForm submitLabel="Save and continue" />
      </AuthLayout>
    )
  }

  if (user.user_type === 'student') {
    return (
      <AuthLayout
        title="Use the mobile app"
        subtitle="Student and parent accounts sign in on the school's mobile app. This website is for staff."
        footer={<button className="link" onClick={logout}>Log out</button>}
      />
    )
  }

  const isManager = MANAGERS.includes(user.user_type)
  const canImport = importableTypes(user.user_type).length > 0
  const nav = NAV.filter((n) => n.roles.includes(user.user_type))
  const title =
    TITLES[location.pathname] ||
    (location.pathname.startsWith('/students') ? 'Student' :
     location.pathname.startsWith('/classes') ? 'Classes' :
     location.pathname.startsWith('/lesson-plans') ? 'Lesson Plans' :
     location.pathname.startsWith('/exams') ? 'Exams' :
     location.pathname.startsWith('/teachers') ? 'Timetable' : 'EduManage')

  return (
    <div className="flex min-h-screen">
      {/* mobile backdrop */}
      <div
        className={`fixed inset-0 z-30 bg-ink/45 transition-opacity md:hidden ${
          navOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={() => setNavOpen(false)}
      />

      {/* sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-60 flex-col gap-[3px] border-r border-line
          bg-white p-5 px-3.5 shadow-pop transition-transform md:translate-x-0 md:shadow-none ${
            navOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
      >
        <div className="flex items-center gap-2.5 px-2.5 pb-5 text-[17px] font-extrabold">
          <span className="grid h-[34px] w-[34px] place-items-center rounded-[10px] bg-brand text-[17px] text-white">
            🎓
          </span>
          EduManage
        </div>
        {nav.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-[11px] rounded-[10px] px-3 py-2.5 font-semibold transition-colors ${
                isActive ? 'bg-brand text-white' : 'text-subtle hover:bg-page hover:text-ink'
              }`
            }
            onClick={() => setNavOpen(false)}
          >
            <span>{n.icon}</span> {n.label}
          </NavLink>
        ))}
        <div className="flex-1" />
        <NavLink
          to="/account"
          title="My account"
          className="flex items-center gap-2.5 rounded-[10px] border-t border-line px-2.5 py-3 hover:bg-page"
        >
          <div className="avatar">{user.full_name?.[0]?.toUpperCase() || '?'}</div>
          <div className="min-w-0">
            <div className="truncate text-[13.5px] font-bold">{user.full_name}</div>
            <div className="text-[11.5px] text-subtle">{roleLabel(user.user_type)} · My account</div>
          </div>
        </NavLink>
        <button className="ghost" onClick={logout}>Log out</button>
      </aside>

      <div className="min-w-0 flex-1 md:ml-60">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-line bg-page/85 px-4 py-3.5 backdrop-blur md:px-7">
          <button
            className="grid h-[38px] w-[38px] place-items-center border border-line bg-white p-0 text-[17px] text-ink md:hidden"
            onClick={() => setNavOpen(true)}
            aria-label="Menu"
          >
            ☰
          </button>
          <h1 className="flex-1 text-lg font-extrabold">{title}</h1>
          <span className="chip hidden md:inline-flex">
            🗓️ {new Date().toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}
          </span>
          <span className="chip">{roleLabel(user.user_type)}</span>
        </header>
        <div className="p-4 pb-12 md:px-7 md:pt-6">
          <Routes>
            <Route
              path="/"
              element={user.user_type === 'driver'
                ? <Navigate to="/transport" replace />
                : <Dashboard user={user} />}
            />
            {isManager && <Route path="/users" element={<Users user={user} />} />}
            {canImport && <Route path="/users/import" element={<UserImport user={user} />} />}
            <Route path="/account" element={<Account user={user} />} />
            {isManager && <Route path="/classes" element={<Classes user={user} />} />}
            {user.user_type === 'teacher' && (
              <Route path="/my-classes" element={<MyClasses user={user} />} />
            )}
            {user.user_type === 'teacher' && (
              <Route path="/my-timetable" element={<TeacherTimetable user={user} mine />} />
            )}
            {isManager && (
              <Route path="/teachers/:teacherId/timetable" element={<TeacherTimetable user={user} />} />
            )}
            <Route path="/classes/:classId/sections/:sectionId" element={<SectionPage user={user} />} />
            <Route path="/students/:studentId" element={<StudentPage user={user} />} />
            <Route path="/lesson-plans" element={<LessonPlans user={user} />} />
            {user.user_type === 'teacher' && (
              <Route path="/lesson-plans/new" element={<LessonPlanForm user={user} />} />
            )}
            <Route path="/notices" element={<Notices user={user} />} />
            {isManager && <Route path="/reception" element={<Reception />} />}
            {isManager && <Route path="/fees" element={<Fees />} />}
            {(isManager || user.user_type === 'driver') && (
              <Route path="/transport" element={<Transport user={user} />} />
            )}
            {isManager && <Route path="/sms" element={<BulkSMS />} />}
            {isManager && <Route path="/payments" element={<Payments />} />}
            <Route path="/attendance" element={<Attendance user={user} />} />
            <Route path="/exams" element={<Exams user={user} />} />
            <Route path="/calendar" element={<Calendar user={user} />} />
            <Route path="/exams/:examId" element={<ExamDetail user={user} />} />
            <Route path="/exams/:examId/results" element={<ExamResults user={user} />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </div>
    </div>
  )
}
