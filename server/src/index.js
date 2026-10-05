import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { z } from 'zod'
import { createApp } from './app.js'

const environment = z.object({
  CLIENT_ORIGIN: z.string().url().default('http://localhost:5173'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  COOKIE_SAME_SITE: z.enum(['lax', 'none', 'strict']).optional(),
}).parse(process.env)

const prisma = new PrismaClient()
const secureCookies = environment.NODE_ENV === 'production'
const sameSiteCookies = environment.COOKIE_SAME_SITE || (secureCookies ? 'none' : 'lax')
if (sameSiteCookies === 'none' && !secureCookies) {
  throw new Error('COOKIE_SAME_SITE=none requires NODE_ENV=production so cookies are secure.')
}

const app = createApp({
  clientOrigin: environment.CLIENT_ORIGIN,
  prisma,
  secureCookies,
  sameSiteCookies,
})

app.listen(environment.PORT, () => {
  console.log(`GigLedger API listening on port ${environment.PORT}`)
})
