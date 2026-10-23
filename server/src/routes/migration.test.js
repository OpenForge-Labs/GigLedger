
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createServer } from 'node:http'
import { createApp } from '../app.js'

const servers = []

function makeOrder(overrides = {}) {
  return {
    id: '123e4567-e89b-42d3-a456-426614174000',
    platform: 'Zomato',
    earnings: 500,
    distance: 10,
    timeMinutes: 30,
    timestamp: '2026-10-23T10:00:00+05:30',
    note: 'Test order',
    ...overrides,
  }
}

async function startApp({ authenticated = true } = {}) {
  const transaction = {
    order: {
      createMany: vi.fn(async ({ data }) => ({
        count: data.length,
      })),
    },
    settings: {
      upsert: vi.fn(async () => ({})),
    },
  }

  const prisma = {
    session: {
      findUnique: vi.fn(async () =>
        authenticated
          ? {
              id: 'session-1',
              userId: 'user-1',
              user: { id: 'user-1' },
              expiresAt: new Date(Date.now() + 60_000),
            }
          : null,
      ),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
    $transaction: vi.fn(async (callback) => callback(transaction)),
  }

  const app = createApp({
    clientOrigin: 'http://localhost:5173',
    prisma,
    secureCookies: false,
    sameSiteCookies: 'lax',
  })

  const server = createServer(app)

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  servers.push(server)

  const address = server.address()
  const url = `http://127.0.0.1:${address.port}`

  async function post(body, withCookie = true) {
    return fetch(`${url}/api/migrations/local-data`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(withCookie
          ? { cookie: 'gigledger_session=test-token' }
          : {}),
      },
      body: JSON.stringify(body),
    })
  }

  return { prisma, transaction, post }
}

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise((resolve, reject) =>
          server.close((error) => error ? reject(error) : resolve()),
        ),
    ),
  )
})

describe('POST /api/migrations/local-data', () => {
  it('rejects unauthenticated requests', async () => {
    const { post } = await startApp({ authenticated: false })

    const response = await post({ orders: [] }, false)
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body.error.code).toBe('UNAUTHENTICATED')
  })

  it('imports valid orders', async () => {
    const { post, transaction } = await startApp()

    const response = await post({ orders: [makeOrder()] })
    const body = await response.json()

    expect(response.status).toBe(201)
    expect(body.data.importedOrders).toBe(1)
    expect(body.data.skippedDuplicates).toBe(0)
    expect(transaction.order.createMany).toHaveBeenCalledOnce()
  })

  it('imports optional settings', async () => {
    const { post, transaction } = await startApp()

    const settings = {
      mileageKmPerLitre: 40,
      petrolPricePerLitre: 100,
    }

    const response = await post({
      orders: [makeOrder()],
      settings,
    })
    const body = await response.json()

    expect(response.status).toBe(201)
    expect(body.data.settingsImported).toBe(true)
    expect(transaction.settings.upsert).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      create: { userId: 'user-1', ...settings },
      update: settings,
    })
  })

  it('accepts an empty order list', async () => {
    const { post, transaction } = await startApp()

    const response = await post({ orders: [] })
    const body = await response.json()

    expect(response.status).toBe(201)
    expect(body.data.importedOrders).toBe(0)
    expect(body.data.skippedDuplicates).toBe(0)
    expect(transaction.order.createMany).not.toHaveBeenCalled()
  })

  it('rejects invalid order data', async () => {
    const { post, transaction } = await startApp()

    const response = await post({
      orders: [makeOrder({ earnings: -10 })],
    })
    const body = await response.json()

    expect(response.status).toBe(422)
    expect(body.error.code).toBe('VALIDATION_ERROR')
    expect(transaction.order.createMany).not.toHaveBeenCalled()
  })

  it('reports duplicate orders as skipped', async () => {
    const { post, transaction } = await startApp()

    transaction.order.createMany.mockResolvedValue({ count: 1 })

    const response = await post({
      orders: [
        makeOrder(),
        makeOrder({
          id: '223e4567-e89b-42d3-a456-426614174000',
        }),
      ],
    })
    const body = await response.json()

    expect(response.status).toBe(201)
    expect(body.data.importedOrders).toBe(1)
    expect(body.data.skippedDuplicates).toBe(1)
    expect(transaction.order.createMany).toHaveBeenCalledOnce()
  })

  it('returns accurate import counts', async () => {
    const { post, transaction } = await startApp()

    transaction.order.createMany.mockResolvedValue({ count: 2 })

    const response = await post({
      orders: [
        makeOrder(),
        makeOrder({
          id: '223e4567-e89b-42d3-a456-426614174000',
        }),
        makeOrder({
          id: '323e4567-e89b-42d3-a456-426614174000',
        }),
      ],
    })
    const body = await response.json()

    expect(response.status).toBe(201)
    expect(body.data.importedOrders).toBe(2)
    expect(body.data.skippedDuplicates).toBe(1)
  })
})



