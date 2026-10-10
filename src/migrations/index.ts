import * as migration_20261010_011636 from './20261010_011636';
import * as migration_20261010_011659 from './20261010_011659';

export const migrations = [
  {
    up: migration_20261010_011636.up,
    down: migration_20261010_011636.down,
    name: '20261010_011636',
  },
  {
    up: migration_20261010_011659.up,
    down: migration_20261010_011659.down,
    name: '20261010_011659'
  },
];
