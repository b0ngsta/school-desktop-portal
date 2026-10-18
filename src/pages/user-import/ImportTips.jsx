import React from 'react'

const TIPS = [
  <>Save as <b>CSV UTF-8</b> (Excel: File → Save As → CSV UTF-8; Google Sheets: File → Download → CSV). Plain “CSV” from Excel breaks Hindi/Tamil names.</>,
  <>Format phone and admission-number columns as <b>Text</b> before typing, or Excel turns 9876543210 into 9.88E+09 and drops leading zeros.</>,
  <>In exports, values starting with + = - @ begin with an apostrophe so Excel doesn't run them as formulas. Leave it; the import removes it.</>,
  <>New users are asked to change their password the first time they sign in.</>,
]

const LIMITS = [
  ['Change a username (it is the matching key)', 'Create a new account'],
  ['Change a password (ignored for existing users)', 'Forgot password, or change password'],
  ['Clear a field (blank = keep)', 'The edit form'],
  ['Move a student to another section', 'The student edit form'],
  ["Change an account's type", '—'],
  ['Delete users (rows missing from the file are left alone)', 'Delete on the users/students screen'],
]

export default function ImportTips({ withPhotos }) {
  return (
    <details className="disclosure">
      <summary>Tips and what a re-upload can't do</summary>
      <ul className="hint-list">
        {TIPS.map((t, i) => <li key={i}>{t}</li>)}
        {withPhotos && (
          <li>Name each photo after the admission number, e.g. <code>ADM1023.jpg</code>, put the same name in
            the <code>photo</code> column and the photos in a ZIP. JPEG/PNG/WebP only.</li>
        )}
      </ul>
      <div className="table-wrap mt-2">
        <table>
          <thead><tr><th>A re-upload cannot…</th><th>Do it with</th></tr></thead>
          <tbody>
            {LIMITS.map(([what, how]) => <tr key={what}><td>{what}</td><td className="muted">{how}</td></tr>)}
          </tbody>
        </table>
      </div>
    </details>
  )
}
