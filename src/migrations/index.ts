import * as migration_20261010_121318 from './20261010_121318';
import * as migration_20261011_204952 from './20261011_204952';
import * as migration_20261012_120336_bridge_application_form from './20261012_120336_bridge_application_form';
import * as migration_20261013_165133_remove_unused_fields from './20261013_165133_remove_unused_fields';
import * as migration_20261018_042322_publication_drafts from './20261018_042322_publication_drafts';
import * as migration_20261018_044627_google_sign_in from './20261018_044627_google_sign_in';
import * as migration_20261018_051000_drop_press_seo from './20261018_051000_drop_press_seo';
import * as migration_20261018_073550_contact_spam_check_exports from './20261018_073550_contact_spam_check_exports';

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
    name: '20261013_165133_remove_unused_fields',
  },
  {
    up: migration_20261018_042322_publication_drafts.up,
    down: migration_20261018_042322_publication_drafts.down,
    name: '20261018_042322_publication_drafts',
  },
  {
    up: migration_20261018_044627_google_sign_in.up,
    down: migration_20261018_044627_google_sign_in.down,
    name: '20261018_044627_google_sign_in',
  },
  {
    up: migration_20261018_051000_drop_press_seo.up,
    down: migration_20261018_051000_drop_press_seo.down,
    name: '20261018_051000_drop_press_seo',
  },
  {
    up: migration_20261018_073550_contact_spam_check_exports.up,
    down: migration_20261018_073550_contact_spam_check_exports.down,
    name: '20261018_073550_contact_spam_check_exports'
  },
];
