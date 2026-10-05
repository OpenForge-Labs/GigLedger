import { useState } from 'react'
import {
  importLocalData,
  loginAccount,
  logoutAccount,
  registerAccount,
} from '../lib/api'

function messageFor(error) {
  if (error?.code === 'NETWORK_ERROR') return error.message
  if (error?.details?.[0]?.message) return error.details[0].message
  return error?.message || 'Something went wrong. Please try again.'
}

export default function AccountPanel({ user, checking, orders, settings, onAccountChange }) {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [importState, setImportState] = useState('idle')

  const hasLocalData = orders.length > 0 || (
    Number(settings.mileageKmPerLitre) !== 40 || Number(settings.petrolPricePerLitre) !== 105
  )

  async function handleSubmit(event) {
    event.preventDefault()
    setBusy(true)
    setMessage('')
    try {
      const action = mode === 'login' ? loginAccount : registerAccount
      const data = await action({ email, password })
      setPassword('')
      onAccountChange(data.user)
      setMessage(mode === 'login' ? 'Signed in. Your phone data is still here.' : 'Account created.')
    } catch (error) {
      setMessage(messageFor(error))
    } finally {
      setBusy(false)
    }
  }

  async function handleImport() {
    setBusy(true)
    setMessage('')
    try {
      const result = await importLocalData({ orders, settings })
      setImportState('complete')
      setMessage(`${result.importedOrders} orders backed up to your account.`)
    } catch (error) {
      setImportState('failed')
      setMessage(messageFor(error))
    } finally {
      setBusy(false)
    }
  }

  async function handleLogout() {
    setBusy(true)
    setMessage('')
    try {
      await logoutAccount()
      setImportState('idle')
      onAccountChange(null)
      setMessage('Signed out. Local orders remain available on this phone.')
    } catch (error) {
      setMessage(messageFor(error))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="card info-card account-panel" aria-busy={busy || checking}>
      <div className="account-heading">
        <div>
          <h2 className="section-title">Account & sync</h2>
          <p className="muted">Your local data stays usable offline.</p>
        </div>
        {user && <span className="account-status">Connected</span>}
      </div>

      {message && <p className="account-message" role="status">{message}</p>}

      {checking ? (
        <p className="muted tiny">Checking your account...</p>
      ) : user ? (
        <>
          <p className="account-email">Signed in as <strong>{user.email}</strong></p>
          {hasLocalData && importState !== 'complete' && (
            <div className="import-callout">
              <strong>Back up data from this phone?</strong>
              <span>{orders.length} local order{orders.length === 1 ? '' : 's'} will be added to your account. Existing local data is not deleted.</span>
              <div className="btn-row">
                <button type="button" className="btn btn-primary btn-block" disabled={busy} onClick={handleImport}>
                  {busy ? 'Backing up...' : 'Back up local data'}
                </button>
                <button type="button" className="btn btn-ghost btn-block" disabled={busy} onClick={() => setImportState('skipped')}>
                  Not now
                </button>
              </div>
            </div>
          )}
          <button type="button" className="btn btn-secondary btn-block" disabled={busy} onClick={handleLogout}>
            Sign out
          </button>
        </>
      ) : (
        <form className="account-form" onSubmit={handleSubmit}>
          <div className="segmented" aria-label="Account action">
            <button type="button" className={`seg ${mode === 'login' ? 'active' : ''}`} onClick={() => setMode('login')}>
              Sign in
            </button>
            <button type="button" className={`seg ${mode === 'register' ? 'active' : ''}`} onClick={() => setMode('register')}>
              Create account
            </button>
          </div>
          <label className="field">
            <span className="field-label">Email</span>
            <input className="input" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </label>
          <label className="field">
            <span className="field-label">Password</span>
            <input className="input" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength="8" value={password} onChange={(event) => setPassword(event.target.value)} required />
            <span className="field-hint">At least 8 characters</span>
          </label>
          <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
            {busy ? 'Please wait...' : mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>
      )}
    </section>
  )
}
