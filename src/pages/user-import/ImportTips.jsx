import React from 'react'

const TIPS = [
  <>Fill in the downloaded <b>Excel template</b> and upload it as it is (.xlsx). From Google Sheets use File → Download → Microsoft Excel (.xlsx).</>,
  <>Phone, roll and admission-number columns are already <b>text</b> in the template, so leading zeros and + are kept.</>,
  <>Keep the column names in the first row; the “How to fill” sheet in the template lists the required columns.</>,
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
