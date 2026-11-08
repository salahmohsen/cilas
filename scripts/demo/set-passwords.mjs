// Prints SQL that gives the three demo accounts known passwords (Payload's pbkdf2 format).
import { pbkdf2Sync, randomBytes } from 'node:crypto'

for (const [id, password] of [
  [1, 'demo-admin-pass'],
  [3, 'demo-fellow-pass'],
  [33, 'demo-member-pass'],
]) {
  const salt = randomBytes(32).toString('hex')
  const hash = pbkdf2Sync(password, salt, 25000, 512, 'sha256').toString('hex')
  console.log(
    `update users set salt='${salt}', hash='${hash}', login_attempts=0, lock_until=null where id=${id};`,
  )
}
