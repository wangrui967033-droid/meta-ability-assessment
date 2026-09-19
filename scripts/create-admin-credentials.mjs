import { randomBytes, scryptSync } from 'node:crypto'

const password = process.env.ADMIN_PASSWORD
if (!password) {
  console.error('请通过 ADMIN_PASSWORD 环境变量提供管理员密码。')
  process.exitCode = 1
} else {
  const cost = 16_384
  const blockSize = 8
  const parallelization = 1
  const salt = randomBytes(16)
  const derivedKey = scryptSync(password, salt, 64, {
    N: cost,
    r: blockSize,
    p: parallelization,
    maxmem: 64 * 1024 * 1024,
  })
  const passwordHash = [
    'scrypt',
    cost,
    blockSize,
    parallelization,
    salt.toString('base64url'),
    derivedKey.toString('base64url'),
  ].join('$')

  console.log(`ADMIN_PASSWORD_HASH=${passwordHash}`)
  console.log(`SESSION_SECRET=${randomBytes(32).toString('base64url')}`)
  console.log(`PHONE_ENCRYPTION_KEY=${randomBytes(32).toString('base64url')}`)
  console.log(`PHONE_LOOKUP_SECRET=${randomBytes(32).toString('base64url')}`)
}
