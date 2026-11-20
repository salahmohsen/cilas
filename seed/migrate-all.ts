import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-postgres'
import type { Payload } from 'payload'

import { migrations } from '../src/migrations/index.js'

export const migrateAll = (payload: Payload) =>
  payload.db.migrate({
    migrations: migrations.map(({ name, up, down }) => ({
      name,
      up: (args: unknown) => up(args as MigrateUpArgs),
      down: (args: unknown) => down(args as MigrateDownArgs),
    })),
  })
