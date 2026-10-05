import { createHash, randomBytes } from 'node:crypto'

export const SESSION_COOKIE = 'gigledger_session'
const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000

function hashToken(token) {
  return createHash('sha256').update(token).digest('hex')
}

function readCookie(request, name) {
  const prefix = `${name}=`
  const cookie = request.headers.cookie || ''
  const value = cookie.split(';').map((part) => part.trim()).find((part) => part.startsWith(prefix))
  if (!value) return null
  try {
    return decodeURIComponent(value.slice(prefix.length))
  } catch {
    return null
  }
}

export function cookieOptions({ secure, sameSite }) {
  return {
    httpOnly: true,
    secure,
    sameSite,
    path: '/',
    maxAge: SESSION_DURATION_MS,
  }
}

export async function createSession(prisma, userId) {
  const token = randomBytes(32).toString('base64url')
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS)
  await prisma.session.create({
    data: { userId, tokenHash: hashToken(token), expiresAt },
  })
  return { token, expiresAt }
}

export async function loadSession(prisma, request) {
  const token = readCookie(request, SESSION_COOKIE)
  if (!token) return null

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  })
  if (!session) return null
  if (session.expiresAt <= new Date()) {
    await prisma.session.delete({ where: { id: session.id } })
    return null
  }

  return { ...session, token }
}

export async function destroySession(prisma, request) {
  const token = readCookie(request, SESSION_COOKIE)
  if (!token) return
  await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } })
}

export function requireUser(prisma) {
  return async (request, response, next) => {
    try {
      const session = await loadSession(prisma, request)
      if (!session) {
        return response.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Sign in is required.' } })
      }
      request.user = session.user
      request.session = session
      return next()
    } catch (error) {
      return next(error)
    }
  }
}
