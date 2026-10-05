import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import { createAuthRouter } from './routes/auth.js'
import { createMigrationRouter } from './routes/migration.js'

export function createApp({ clientOrigin, prisma, secureCookies, sameSiteCookies }) {
  const app = express()

  app.disable('x-powered-by')
  app.set('trust proxy', 1)
  app.use(helmet())
  app.use(cors({ origin: clientOrigin, credentials: true }))
  app.use(express.json({ limit: '100kb' }))

  app.get('/health', (_request, response) => {
    response.json({ status: 'ok' })
  })

  app.use('/api/auth', createAuthRouter({ prisma, secureCookies, sameSiteCookies }))
  app.use('/api/migrations', createMigrationRouter({ prisma }))

  app.use((error, _request, response, _next) => {
    if (error instanceof SyntaxError && 'body' in error) {
      return response.status(400).json({ error: { code: 'INVALID_JSON', message: 'Request body must be valid JSON.' } })
    }

    console.error(error)
    return response.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Unexpected server error.' } })
  })

  return app
}
