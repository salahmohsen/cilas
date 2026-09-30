import * as migration_20260930_040511_initial_baseline from './20260930_040511_initial_baseline';
import * as migration_20260930_052247 from './20260930_052247';

export const migrations = [
  {
    up: migration_20260930_040511_initial_baseline.up,
    down: migration_20260930_040511_initial_baseline.down,
    name: '20260930_040511_initial_baseline',
  },
  {
    up: migration_20260930_052247.up,
    down: migration_20260930_052247.down,
    name: '20260930_052247'
  },
];
