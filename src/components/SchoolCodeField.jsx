import React from 'react'
import { Field } from './ui.jsx'

/**
 * "School code" input for the signed-out screens, with the school's name (or
 * an "unknown code" warning) underneath. `school` comes from useSchoolName.
 */
export default function SchoolCodeField({ value, onChange, school, autoFocus }) {
  return (
    <Field label="School code">
      <input value={value} onChange={(e) => onChange(e.target.value.toUpperCase().replace(/\s/g, ''))}
        placeholder="e.g. XYZPS" autoComplete="organization" autoCapitalize="characters"
        maxLength={30} required autoFocus={autoFocus} />
      {school.state === 'found' && <p className="muted small mt-1">🏫 {school.name}</p>}
      {school.state === 'unknown' && (
        <p className="small mt-1 text-danger">School code not found. Check it with your school office.</p>
      )}
    </Field>
  )
}
