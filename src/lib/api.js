const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3001').replace(/\/$/, '')

export class ApiError extends Error {
  constructor(message, { status, code, details } = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
  }
}

async function request(path, options = {}) {
  let response
  try {
    response = await fetch(`${API_URL}${path}`, {
      credentials: 'include',
      headers: options.body ? { 'Content-Type': 'application/json', ...options.headers } : options.headers,
      ...options,
    })
  } catch {
    throw new ApiError('Could not reach GigLedger sync. Your orders are still saved on this phone.', {
      code: 'NETWORK_ERROR',
    })
  }

  const payload = response.status === 204 ? null : await response.json().catch(() => null)
  if (!response.ok) {
    throw new ApiError(payload?.error?.message || 'Something went wrong. Please try again.', {
      status: response.status,
      code: payload?.error?.code,
      details: payload?.error?.details,
    })
  }
  return payload?.data ?? null
}

export function getCurrentUser() {
  return request('/api/auth/me')
}

export function registerAccount(credentials) {
  return request('/api/auth/register', { method: 'POST', body: JSON.stringify(credentials) })
}

export function loginAccount(credentials) {
  return request('/api/auth/login', { method: 'POST', body: JSON.stringify(credentials) })
}

export function logoutAccount() {
  return request('/api/auth/logout', { method: 'POST' })
}

export function importLocalData({ orders, settings }) {
  return request('/api/migrations/local-data', {
    method: 'POST',
    body: JSON.stringify({ orders, settings }),
  })
}
