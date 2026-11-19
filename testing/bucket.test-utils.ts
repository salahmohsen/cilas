import { GetObjectCommand, ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3'

const client = () =>
  new S3Client({
    endpoint: process.env.R2_ENDPOINT,
    region: process.env.R2_REGION ?? 'us-east-1',
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID ?? '',
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? '',
    },
  })

export const bucketKeys = async (prefix: string) => {
  const s3 = client()
  const keys: string[] = []
  let token: string | undefined
  do {
    const page = await s3.send(
      new ListObjectsV2Command({
        Bucket: process.env.R2_BUCKET,
        Prefix: prefix,
        ContinuationToken: token,
      }),
    )
    keys.push(...(page.Contents ?? []).flatMap((object) => (object.Key ? [object.Key] : [])))
    token = page.NextContinuationToken
  } while (token)
  s3.destroy()
  return keys.sort()
}

export const bucketObject = async (key: string) => {
  const s3 = client()
  const object = await s3.send(new GetObjectCommand({ Bucket: process.env.R2_BUCKET, Key: key }))
  const bytes = Buffer.from((await object.Body?.transformToByteArray()) ?? [])
  s3.destroy()
  return bytes
}
