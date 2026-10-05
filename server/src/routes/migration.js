import { Router } from 'express'
import { z } from 'zod'
import { requireUser } from '../lib/sessions.js'
import { validateBody } from '../lib/validation.js'

const platformMap = {
  Zomato: 'ZOMATO',
  Swiggy: 'SWIGGY',
  Uber: 'UBER',
  Rapido: 'RAPIDO',
  Ola: 'OLA',
  Other: 'OTHER',
}

const localOrderSchema = z.object({
  id: z.string().uuid(),
  platform: z.enum(['Zomato', 'Swiggy', 'Uber', 'Rapido', 'Ola', 'Other']),
  earnings: z.number().finite().min(0),
  distance: z.number().finite().min(0),
  timeMinutes: z.number().finite().int().min(0),
  timestamp: z.string().datetime({ offset: true }),
  note: z.string().max(120).optional().default(''),
})

const importSchema = z.object({
  orders: z.array(localOrderSchema).max(10000),
  settings: z.object({
    mileageKmPerLitre: z.number().finite().positive().max(200),
    petrolPricePerLitre: z.number().finite().nonnegative().max(1000),
  }).optional(),
})

export function createMigrationRouter({ prisma }) {
  const router = Router()

  router.post('/local-data', requireUser(prisma), validateBody(importSchema), async (request, response, next) => {
    try {
      const { orders, settings } = request.validatedBody
      const importedAt = new Date()
      const result = await prisma.$transaction(async (transaction) => {
        const inserted = orders.length
          ? await transaction.order.createMany({
            data: orders.map((order) => ({
              userId: request.user.id,
              clientId: order.id,
              platform: platformMap[order.platform],
              earnings: order.earnings,
              distanceKm: order.distance,
              durationMinutes: order.timeMinutes,
              occurredAt: new Date(order.timestamp),
              note: order.note,
              clientUpdatedAt: importedAt,
            })),
            skipDuplicates: true,
          })
          : { count: 0 }

        if (settings) {
          await transaction.settings.upsert({
            where: { userId: request.user.id },
            create: { userId: request.user.id, ...settings },
            update: settings,
          })
        }

        return inserted
      })

      return response.status(201).json({
        data: {
          importedOrders: result.count,
          skippedDuplicates: orders.length - result.count,
          settingsImported: Boolean(settings),
        },
      })
    } catch (error) {
      return next(error)
    }
  })

  return router
}
