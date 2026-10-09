import * as migration_20261008_200034 from './20261008_200034';
import * as migration_20261008_201201 from './20261008_201201';
import * as migration_20261008_204757 from './20261008_204757';
import * as migration_20261008_204817 from './20261008_204817';
import * as migration_20261008_204833 from './20261008_204833';
import * as migration_20261008_210048 from './20261008_210048';

export const migrations = [
  {
    up: migration_20261008_200034.up,
    down: migration_20261008_200034.down,
    name: '20261008_200034',
  },
  {
    up: migration_20261008_201201.up,
    down: migration_20261008_201201.down,
    name: '20261008_201201',
  },
  {
    up: migration_20261008_204757.up,
    down: migration_20261008_204757.down,
    name: '20261008_204757',
  },
  {
    up: migration_20261008_204817.up,
    down: migration_20261008_204817.down,
    name: '20261008_204817',
  },
  {
    up: migration_20261008_204833.up,
    down: migration_20261008_204833.down,
    name: '20261008_204833',
  },
  {
    up: migration_20261008_210048.up,
    down: migration_20261008_210048.down,
    name: '20261008_210048'
  },
];
