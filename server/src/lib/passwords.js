import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

const scrypt = promisify(scryptCallback)
const KEY_LENGTH = 64
// OWASP-style memory-hard work factor. Keep this versioned format so the
// parameters can be raised later and hashes re-created on successful login.
const SCRYPT_PARAMETERS = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }

export async function hashPassword(password) {
  const salt = randomBytes(16)
  const derivedKey = await scrypt(password, salt, KEY_LENGTH, SCRYPT_PARAMETERS)
  return [
    'scrypt',
    SCRYPT_PARAMETERS.N,
    SCRYPT_PARAMETERS.r,
    SCRYPT_PARAMETERS.p,
    salt.toString('base64url'),
    derivedKey.toString('base64url'),
  ].join('$')
}

export async function verifyPassword(password, encodedHash) {
  const [algorithm, n, r, p, salt, storedKey] = String(encodedHash).split('$')
  if (algorithm !== 'scrypt' || !salt || !storedKey) return false

  const parameters = {
    N: Number(n),
    r: Number(r),
    p: Number(p),
    maxmem: 64 * 1024 * 1024,
  }
  if (!Number.isSafeInteger(parameters.N) || !Number.isSafeInteger(parameters.r) || !Number.isSafeInteger(parameters.p)) {
    return false
  }

  try {
    const derivedKey = await scrypt(password, Buffer.from(salt, 'base64url'), KEY_LENGTH, parameters)
    const expectedKey = Buffer.from(storedKey, 'base64url')
    return expectedKey.length === derivedKey.length && timingSafeEqual(expectedKey, derivedKey)
  } catch {
    return false
  }
}
