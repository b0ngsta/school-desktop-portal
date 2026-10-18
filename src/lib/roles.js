/**
 * User roles and the permission rules the UI mirrors from the backend
 * (app/core/roles.py, services/users.py, services/user_import/service.py).
 * The backend stays the source of truth; these only decide what to show.
 */

export const MANAGERS = ['admin', 'principal', 'sub_admin', 'coordinator']
export const STAFF = [...MANAGERS, 'teacher']

/** Accounts only an admin may create, edit or delete. */
export const ADMIN_MANAGED = ['admin', 'principal', 'sub_admin']

export const ROLE_LABELS = {
  admin: 'Admin',
  principal: 'Principal',
  sub_admin: 'Sub-admin',
  coordinator: 'Coordinator',
  teacher: 'Teacher',
  driver: 'Driver',
  student: 'Student',
}

/** Display order for role pickers. */
const ALL_STAFF_TYPES = ['admin', 'principal', 'sub_admin', 'coordinator', 'teacher', 'driver']

export const roleLabel = (type) => ROLE_LABELS[type] || String(type || '').replace(/_/g, ' ')

export const isManager = (type) => MANAGERS.includes(type)

/** Staff types the actor may create with the "Add user" form. */
export function creatableStaffTypes(actorType) {
  if (actorType === 'admin') return ALL_STAFF_TYPES
  if (isManager(actorType)) return ALL_STAFF_TYPES.filter((t) => !ADMIN_MANAGED.includes(t))
  return []
}

/** Account types the actor may bulk-import from a CSV. */
export function importableTypes(actorType) {
  if (actorType === 'admin') return [...ALL_STAFF_TYPES, 'student']
  if (isManager(actorType)) return ['coordinator', 'teacher', 'driver', 'student']
  if (actorType === 'teacher') return ['student']
  return []
}

/** Whether the actor may edit/delete an existing account of `targetType`. */
export function canManageAccount(actorType, targetType) {
  if (!isManager(actorType)) return false
  return !ADMIN_MANAGED.includes(targetType) || actorType === 'admin'
}
