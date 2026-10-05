import { Router } from 'express'
import { z } from 'zod'
import { hashPassword, verifyPassword } from '../lib/passwords.js'
import { createRateLimiter } from '../lib/rate-limit.js'
import { cookieOptions, createSession, destroySession, loadSession, SESSION_COOKIE } from '../lib/sessions.js'
import { validateBody } from '../lib/validation.js'

const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(320),
  // scrypt accepts longer strings, but this cap prevents abusive input sizes.
  password: z.string().min(8).max(128),
})

function publicUser(user) {
  return { id: user.id, email: user.email, createdAt: user.createdAt }
}

export function createAuthRouter({ prisma, secureCookies, sameSiteCookies }) {
  const router = Router()
  const loginLimit = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: 'Too many sign-in attempts. Please wait 15 minutes and try again.',
  })
  const registrationLimit = createRateLimiter({
    windowMs: 60 * 60 * 1000,
    max: 5,
    message: 'Too many accounts created from this connection. Please try again later.',
  })
  const sessionOptions = cookieOptions({ secure: secureCookies, sameSite: sameSiteCookies })

  router.post('/register', registrationLimit, validateBody(credentialsSchema), async (request, response, next) => {
    try {
      const { email, password } = request.validatedBody
      const passwordHash = await hashPassword(password)
      const user = await prisma.user.create({
        data: { email, passwordHash, settings: { create: {} } },
      })
      const session = await createSession(prisma, user.id)
      response.cookie(SESSION_COOKIE, session.token, sessionOptions)
      return response.status(201).json({ data: { user: publicUser(user) } })
    } catch (error) {
      if (error.code === 'P2002') {
        return response.status(409).json({ error: { code: 'EMAIL_IN_USE', message: 'An account already uses this email.' } })
      }
      return next(error)
    }
  })

  router.post('/login', loginLimit, validateBody(credentialsSchema), async (request, response, next) => {
    try {
      const { email, password } = request.validatedBody
      const user = await prisma.user.findUnique({ where: { email } })
      const valid = user && await verifyPassword(password, user.passwordHash)
      if (!valid) {
        return response.status(401).json({ error: { code: 'INVALID_CREDENTIALS', message: 'Email or password is incorrect.' } })
      }
      const session = await createSession(prisma, user.id)
      response.cookie(SESSION_COOKIE, session.token, sessionOptions)
      return response.json({ data: { user: publicUser(user) } })
    } catch (error) {
      return next(error)
    }
  })

  router.get('/me', async (request, response, next) => {
    try {
      const session = await loadSession(prisma, request)
      if (!session) return response.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Not signed in.' } })
      return response.json({ data: { user: publicUser(session.user) } })
    } catch (error) {
      return next(error)
    }
  })

  router.post('/logout', async (request, response, next) => {
    try {
      await destroySession(prisma, request)
      response.clearCookie(SESSION_COOKIE, sessionOptions)
      return response.status(204).end()
    } catch (error) {
      return next(error)
    }
  })

  return router
}
