import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  addDays,
  aggregateOrders,
  dailyBreakdown,
  estimateFuelCost,
  ordersForDate,
  ordersInLastNDays,
  toDateKey,
} from './calculations'

// 40 km/l at ₹100/l => every 40 km costs exactly ₹100 (₹2.5 per km)
const SETTINGS = { mileageKmPerLitre: 40, petrolPricePerLitre: 100 }

/** Local-time Date, so tests behave the same in any timezone. */
const at = (y, m, d, h = 12, min = 0) => new Date(y, m - 1, d, h, min)

const order = (overrides = {}) => ({
  platform: 'Zomato',
  earnings: 100,
  distance: 10,
  timeMinutes: 30,
  timestamp: at(2026, 1, 15),
  ...overrides,
})

afterEach(() => {
  vi.useRealTimers()
})

describe('toDateKey / addDays helpers', () => {
  it('zero-pads month and day', () => {
    expect(toDateKey(at(2026, 3, 5))).toBe('2026-03-05')
  })

  it('moves across month, year and leap-day boundaries', () => {
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29')
    expect(addDays('2025-12-31', 1)).toBe('2026-01-01')
  })
})

describe('estimateFuelCost', () => {
  it('computes (distance / mileage) * petrol price', () => {
    expect(estimateFuelCost(40, SETTINGS)).toBeCloseTo(100)
    expect(estimateFuelCost(10, { mileageKmPerLitre: 20, petrolPricePerLitre: 110 })).toBeCloseTo(55)
  })

  it('returns 0 for zero distance', () => {
    expect(estimateFuelCost(0, SETTINGS)).toBe(0)
  })

  it('handles decimal distances', () => {
    expect(estimateFuelCost(10.5, SETTINGS)).toBeCloseTo(26.25)
  })

  it('accepts numeric strings in settings', () => {
    const settings = { mileageKmPerLitre: '40', petrolPricePerLitre: '100' }
    expect(estimateFuelCost(40, settings)).toBeCloseTo(100)
  })

  it('falls back to 40 km/l and ₹100/l when settings are missing', () => {
    expect(estimateFuelCost(40, {})).toBeCloseTo(100)
  })

  it('treats a mileage of 0 as unset and uses the 40 km/l fallback', () => {
    // Current behaviour: `Number(0) || 40` => 40, so the `mileage <= 0` guard is not hit.
    expect(estimateFuelCost(40, { mileageKmPerLitre: 0, petrolPricePerLitre: 100 })).toBeCloseTo(100)
  })

  it('returns 0 for a negative mileage', () => {
    expect(estimateFuelCost(40, { mileageKmPerLitre: -5, petrolPricePerLitre: 100 })).toBe(0)
  })
})

describe('aggregateOrders', () => {
  it('returns zeros and null rates for an empty list', () => {
    const r = aggregateOrders([], SETTINGS)
    expect(r).toMatchObject({
      orderCount: 0,
      totalEarnings: 0,
      totalDistance: 0,
      totalMinutes: 0,
      totalHours: 0,
      fuelCost: 0,
      netEarnings: 0,
      realPerHour: null,
      grossPerHour: null,
      platformRows: [],
    })
  })

  it('computes real and gross ₹/hour for a single order', () => {
    const r = aggregateOrders([order({ earnings: 200, distance: 40, timeMinutes: 60 })], SETTINGS)
    expect(r.orderCount).toBe(1)
    expect(r.totalHours).toBeCloseTo(1)
    expect(r.fuelCost).toBeCloseTo(100)
    expect(r.netEarnings).toBeCloseTo(100)
    expect(r.realPerHour).toBeCloseTo(100)
    expect(r.grossPerHour).toBeCloseTo(200)
  })

  it('returns null (never NaN/Infinity) when total time is zero', () => {
    const r = aggregateOrders([order({ earnings: 100, distance: 10, timeMinutes: 0 })], SETTINGS)
    expect(r.totalHours).toBe(0)
    expect(r.realPerHour).toBeNull()
    expect(r.grossPerHour).toBeNull()
    expect(r.netEarnings).toBeCloseTo(75) // earnings and fuel are still computed
    expect(r.platformRows[0].realPerHour).toBeNull()
  })

  it('handles zero distance (no fuel cost)', () => {
    const r = aggregateOrders([order({ earnings: 120, distance: 0, timeMinutes: 60 })], SETTINGS)
    expect(r.fuelCost).toBe(0)
    expect(r.realPerHour).toBeCloseTo(120)
  })

  it('sums decimal earnings, distance and minutes', () => {
    const r = aggregateOrders(
      [
        order({ earnings: 45.5, distance: 3.5, timeMinutes: 20 }),
        order({ earnings: 30.25, distance: 2.5, timeMinutes: 10 }),
      ],
      SETTINGS,
    )
    expect(r.totalEarnings).toBeCloseTo(75.75)
    expect(r.totalDistance).toBeCloseTo(6)
    expect(r.totalHours).toBeCloseTo(0.5)
    expect(r.fuelCost).toBeCloseTo(15)
    expect(r.netEarnings).toBeCloseTo(60.75)
    expect(r.realPerHour).toBeCloseTo(121.5)
    expect(r.grossPerHour).toBeCloseTo(151.5)
  })

  it('can return negative net earnings when fuel exceeds earnings', () => {
    const r = aggregateOrders([order({ earnings: 10, distance: 80, timeMinutes: 60 })], SETTINGS)
    expect(r.fuelCost).toBeCloseTo(200)
    expect(r.netEarnings).toBeCloseTo(-190)
    expect(r.realPerHour).toBeCloseTo(-190)
  })

  it('ignores non-numeric fields but still counts the order', () => {
    const r = aggregateOrders(
      [{ platform: 'Ola', earnings: 'abc', distance: undefined, timeMinutes: null }],
      SETTINGS,
    )
    expect(r.orderCount).toBe(1)
    expect(r.totalEarnings).toBe(0)
    expect(r.totalDistance).toBe(0)
    expect(r.totalMinutes).toBe(0)
    expect(r.netEarnings).toBe(0)
  })

  it('parses numeric strings', () => {
    const r = aggregateOrders([{ platform: 'Uber', earnings: '150', distance: '20', timeMinutes: '60' }], SETTINGS)
    expect(r.totalEarnings).toBe(150)
    expect(r.realPerHour).toBeCloseTo(100)
  })

  describe('multiple platforms and mixed data', () => {
    const orders = [
      order({ platform: 'Zomato', earnings: 100, distance: 10, timeMinutes: 30 }),
      order({ platform: 'Zomato', earnings: 50, distance: 5, timeMinutes: 15 }),
      order({ platform: 'Swiggy', earnings: 300, distance: 20, timeMinutes: 60 }),
      order({ platform: undefined, earnings: 20, distance: 0, timeMinutes: 0 }),
    ]
    const r = aggregateOrders(orders, SETTINGS)
    const row = (name) => r.platformRows.find((p) => p.platform === name)

    it('computes overall totals', () => {
      expect(r.orderCount).toBe(4)
      expect(r.totalEarnings).toBeCloseTo(470)
      expect(r.totalDistance).toBeCloseTo(35)
      expect(r.totalHours).toBeCloseTo(1.75)
      expect(r.fuelCost).toBeCloseTo(87.5)
      expect(r.netEarnings).toBeCloseTo(382.5)
      expect(r.realPerHour).toBeCloseTo(382.5 / 1.75)
    })

    it('groups orders per platform and labels missing platforms "Other"', () => {
      expect(r.platformRows.map((p) => p.platform).sort()).toEqual(['Other', 'Swiggy', 'Zomato'])
      expect(row('Other').count).toBe(1)
    })

    it('computes per-platform stats', () => {
      expect(row('Zomato')).toMatchObject({ count: 2, earnings: 150, distance: 15, minutes: 45 })
      expect(row('Zomato').fuelCost).toBeCloseTo(37.5)
      expect(row('Zomato').netEarnings).toBeCloseTo(112.5)
      expect(row('Zomato').realPerHour).toBeCloseTo(150)
      expect(row('Swiggy').realPerHour).toBeCloseTo(250)
      expect(row('Other').realPerHour).toBeNull() // zero minutes on this platform
    })

    it('sorts platform rows by earnings, highest first', () => {
      expect(r.platformRows.map((p) => p.platform)).toEqual(['Swiggy', 'Zomato', 'Other'])
    })
  })
})

describe('ordersForDate', () => {
  it('returns only orders on that local calendar day, including both edges', () => {
    const inside1 = order({ timestamp: at(2026, 1, 15, 0, 0) })
    const inside2 = order({ timestamp: at(2026, 1, 15, 23, 59) })
    const before = order({ timestamp: at(2026, 1, 14, 23, 59) })
    const after = order({ timestamp: at(2026, 1, 16, 0, 0) })
    const result = ordersForDate([before, inside1, inside2, after], '2026-01-15')
    expect(result).toEqual([inside1, inside2])
  })

  it('returns an empty array for an empty list or no match', () => {
    expect(ordersForDate([], '2026-01-15')).toEqual([])
    expect(ordersForDate([order()], '2026-02-01')).toEqual([])
  })

  it('accepts ISO-string and millisecond timestamps', () => {
    const iso = order({ timestamp: '2026-01-15T10:30:00' }) // no "Z" => local time
    const ms = order({ timestamp: at(2026, 1, 15, 9, 0).getTime() })
    expect(ordersForDate([iso, ms], '2026-01-15')).toHaveLength(2)
  })
})

describe('ordersInLastNDays', () => {
  const end = at(2026, 1, 15, 18, 0)

  it('includes the n-day window (inclusive of both ends) and excludes the rest', () => {
    const oldest = order({ timestamp: at(2026, 1, 9, 0, 0) })
    const tooOld = order({ timestamp: at(2026, 1, 8, 23, 59) })
    const latest = order({ timestamp: at(2026, 1, 15, 23, 59) })
    const future = order({ timestamp: at(2026, 1, 16, 0, 0) })
    const result = ordersInLastNDays([tooOld, oldest, latest, future], 7, end)
    expect(result).toEqual([oldest, latest])
  })

  it('n = 1 returns only the end date', () => {
    const today = order({ timestamp: at(2026, 1, 15) })
    const yesterday = order({ timestamp: at(2026, 1, 14) })
    expect(ordersInLastNDays([today, yesterday], 1, end)).toEqual([today])
  })

  it('n = 0 returns nothing (current behaviour)', () => {
    expect(ordersInLastNDays([order()], 0, end)).toEqual([])
  })

  it('works across a month boundary', () => {
    const inWindow = order({ timestamp: at(2026, 2, 26) }) // window: Feb 26 – Mar 2
    const outside = order({ timestamp: at(2026, 2, 25) })
    expect(ordersInLastNDays([inWindow, outside], 5, at(2026, 3, 2))).toEqual([inWindow])
  })

  it('returns [] for an empty list', () => {
    expect(ordersInLastNDays([], 7, end)).toEqual([])
  })

  it('defaults the end date to "now"', () => {
    vi.useFakeTimers()
    vi.setSystemTime(at(2026, 1, 15, 12, 0))
    const today = order({ timestamp: at(2026, 1, 15, 8, 0) })
    const old = order({ timestamp: at(2026, 1, 1, 8, 0) })
    expect(ordersInLastNDays([today, old], 7)).toEqual([today])
  })
})

describe('dailyBreakdown', () => {
  const end = at(2026, 1, 15)

  it('returns 7 consecutive days by default, oldest first, ending on the end date', () => {
    const result = dailyBreakdown([], SETTINGS, undefined, end)
    expect(result.map((d) => d.dateKey)).toEqual([
      '2026-01-09',
      '2026-01-10',
      '2026-01-11',
      '2026-01-12',
      '2026-01-13',
      '2026-01-14',
      '2026-01-15',
    ])
  })

  it('gives days with no orders zero totals and null rates', () => {
    const [day] = dailyBreakdown([], SETTINGS, 1, end)
    expect(day).toMatchObject({
      dateKey: '2026-01-15',
      orderCount: 0,
      totalEarnings: 0,
      netEarnings: 0,
      realPerHour: null,
      platformRows: [],
    })
  })

  it('aggregates each day separately across platforms', () => {
    const orders = [
      order({ platform: 'Zomato', earnings: 200, distance: 40, timeMinutes: 60, timestamp: at(2026, 1, 15, 9) }),
      order({ platform: 'Swiggy', earnings: 100, distance: 0, timeMinutes: 30, timestamp: at(2026, 1, 15, 14) }),
      order({ platform: 'Rapido', earnings: 90, distance: 20, timeMinutes: 45, timestamp: at(2026, 1, 13, 10) }),
      order({ timestamp: at(2026, 1, 1) }), // outside the window
    ]
    const result = dailyBreakdown(orders, SETTINGS, 3, end)
    expect(result.map((d) => d.dateKey)).toEqual(['2026-01-13', '2026-01-14', '2026-01-15'])

    const [jan13, jan14, jan15] = result
    expect(jan13.orderCount).toBe(1)
    expect(jan13.netEarnings).toBeCloseTo(40) // 90 - 50 fuel
    expect(jan14.orderCount).toBe(0)
    expect(jan15.orderCount).toBe(2)
    expect(jan15.totalEarnings).toBeCloseTo(300)
    expect(jan15.fuelCost).toBeCloseTo(100)
    expect(jan15.realPerHour).toBeCloseTo(200 / 1.5)
    expect(jan15.platformRows.map((p) => p.platform)).toEqual(['Zomato', 'Swiggy'])
  })

  it('returns an empty array when days = 0', () => {
    expect(dailyBreakdown([order()], SETTINGS, 0, end)).toEqual([])
  })

  it('defaults the end date to "now"', () => {
    vi.useFakeTimers()
    vi.setSystemTime(at(2026, 1, 15, 12, 0))
    const result = dailyBreakdown([], SETTINGS, 2)
    expect(result.map((d) => d.dateKey)).toEqual(['2026-01-14', '2026-01-15'])
  })
})