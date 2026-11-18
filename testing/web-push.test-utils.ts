import { createDecipheriv, createECDH, hkdfSync, randomBytes } from 'node:crypto'

const derive = (secret: Buffer, salt: Buffer, info: Buffer, length: number) =>
  Buffer.from(hkdfSync('sha256', secret, salt, info, length))

export const pushDevice = () => {
  const keys = createECDH('prime256v1')
  const publicKey = keys.generateKeys()
  const authSecret = randomBytes(16)

  const open = (body: ArrayBuffer) => {
    const message = Buffer.from(body)
    const salt = message.subarray(0, 16)
    const idLength = message.readUInt8(20)
    const senderKey = message.subarray(21, 21 + idLength)
    const sealed = message.subarray(21 + idLength)
    const ikm = derive(
      keys.computeSecret(senderKey),
      authSecret,
      Buffer.concat([Buffer.from('WebPush: info\0'), publicKey, senderKey]),
      32,
    )
    const decipher = createDecipheriv(
      'aes-128-gcm',
      derive(ikm, salt, Buffer.from('Content-Encoding: aes128gcm\0'), 16),
      derive(ikm, salt, Buffer.from('Content-Encoding: nonce\0'), 12),
    )
    decipher.setAuthTag(sealed.subarray(sealed.length - 16))
    const padded = Buffer.concat([
      decipher.update(sealed.subarray(0, sealed.length - 16)),
      decipher.final(),
    ])
    return padded.subarray(0, padded.lastIndexOf(2)).toString('utf8')
  }

  return {
    p256dh: publicKey.toString('base64url'),
    auth: authSecret.toString('base64url'),
    open,
  }
}
