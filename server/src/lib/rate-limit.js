/**
 * Deliberately small in-memory limiter for a single Railway instance.
 * Replace the Map with Redis before scaling the API horizontally.
 */
export function createRateLimiter({ windowMs, max, message }) {
  const attempts = new Map()

  return (request, response, next) => {
    const now = Date.now()
    for (const [key, attempt] of attempts) {
      if (attempt.resetAt <= now) attempts.delete(key)
    }

    const key = request.ip || 'unknown'
    const attempt = attempts.get(key)
    if (attempt && attempt.count >= max) {
      response.set('Retry-After', String(Math.ceil((attempt.resetAt - now) / 1000)))
      return response.status(429).json({ error: { code: 'RATE_LIMITED', message } })
    }

    attempts.set(key, {
      count: (attempt?.count || 0) + 1,
      resetAt: attempt?.resetAt || now + windowMs,
    })
    return next()
  }
}
