import * as migration_20261010_121318 from './20261010_121318';
import * as migration_20261011_204952 from './20261011_204952';
import * as migration_20261012_120336_bridge_application_form from './20261012_120336_bridge_application_form';
import * as migration_20261013_165133_remove_unused_fields from './20261013_165133_remove_unused_fields';

export const migrations = [
  {
    up: migration_20261010_121318.up,
    down: migration_20261010_121318.down,
    name: '20261010_121318',
  },
  {
    up: migration_20261011_204952.up,
    down: migration_20261011_204952.down,
    name: '20261011_204952',
  },
  {
    up: migration_20261012_120336_bridge_application_form.up,
    down: migration_20261012_120336_bridge_application_form.down,
    name: '20261012_120336_bridge_application_form',
  },
  {
    up: migration_20261013_165133_remove_unused_fields.up,
    down: migration_20261013_165133_remove_unused_fields.down,
    name: '20261013_165133_remove_unused_fields'
  },
];
