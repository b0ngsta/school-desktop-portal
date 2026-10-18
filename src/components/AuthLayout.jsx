import React from 'react'

/**
 * Shell for the signed-out screens (login, forgot password) and the forced
 * password change: one centered card. Restyle here to restyle all of them.
 */
export default function AuthLayout({ title, subtitle, children, footer }) {
  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-brand">🎓</div>
        <h1 className="auth-title">{title}</h1>
        {subtitle && <p className="auth-sub">{subtitle}</p>}
        {children}
        {footer && <div className="auth-footer">{footer}</div>}
      </div>
    </div>
  )
}
