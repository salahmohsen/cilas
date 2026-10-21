import * as migration_20261010_121318 from './20261010_121318';
import * as migration_20261011_204952 from './20261011_204952';
import * as migration_20261012_120336_bridge_application_form from './20261012_120336_bridge_application_form';
import * as migration_20261013_165133_remove_unused_fields from './20261013_165133_remove_unused_fields';
import * as migration_20261018_042322_publication_drafts from './20261018_042322_publication_drafts';
import * as migration_20261018_044627_google_sign_in from './20261018_044627_google_sign_in';
import * as migration_20261018_051000_drop_press_seo from './20261018_051000_drop_press_seo';
import * as migration_20261018_073550_contact_spam_check_exports from './20261018_073550_contact_spam_check_exports';
import * as migration_20261018_080439_applications_people_visible from './20261018_080439_applications_people_visible';
import * as migration_20261018_085018_sitemap_llms_visual_editor from './20261018_085018_sitemap_llms_visual_editor';
import * as migration_20261018_093732_email_settings from './20261018_093732_email_settings';
import * as migration_20261018_094315_emails_newsletter_picks from './20261018_094315_emails_newsletter_picks';
import * as migration_20261018_100126_email_tagline from './20261018_100126_email_tagline';
import * as migration_20261018_102716_newsletter_sections from './20261018_102716_newsletter_sections';
import * as migration_20261018_102744_drop_newsletter_picks from './20261018_102744_drop_newsletter_picks';
import * as migration_20261018_162245_picks_by_type_space_address from './20261018_162245_picks_by_type_space_address';
import * as migration_20261018_165545_about_page_segment_setting from './20261018_165545_about_page_segment_setting';
import * as migration_20261018_174136_drop_about_page from './20261018_174136_drop_about_page';
import * as migration_20261018_175500_backfill_publication_versions from './20261018_175500_backfill_publication_versions';
import * as migration_20261018_180514_card_stack_replaces_foreword from './20261018_180514_card_stack_replaces_foreword';
import * as migration_20261018_183643_article_autosave from './20261018_183643_article_autosave';
import * as migration_20261018_192058_mailing_lists from './20261018_192058_mailing_lists';
import * as migration_20261019_120000_accounts_get_a_person from './20261019_120000_accounts_get_a_person';
import * as migration_20261019_122625_review_for_courses_and_publications from './20261019_122625_review_for_courses_and_publications';
import * as migration_20261019_123324_applicant_questions_and_file_uploads from './20261019_123324_applicant_questions_and_file_uploads';
import * as migration_20261019_131806_notifications from './20261019_131806_notifications';
import * as migration_20261019_140000_published_owners_are_public from './20261019_140000_published_owners_are_public';
import * as migration_20261019_141427_navigation_switches from './20261019_141427_navigation_switches';
import * as migration_20261019_224849_review_request from './20261019_224849_review_request';
import * as migration_20261021_152008_rename_spaces_to_places from './20261021_152008_rename_spaces_to_places';

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
    name: '20261018_073550_contact_spam_check_exports',
  },
  {
    up: migration_20261018_080439_applications_people_visible.up,
    down: migration_20261018_080439_applications_people_visible.down,
    name: '20261018_080439_applications_people_visible',
  },
  {
    up: migration_20261018_085018_sitemap_llms_visual_editor.up,
    down: migration_20261018_085018_sitemap_llms_visual_editor.down,
    name: '20261018_085018_sitemap_llms_visual_editor',
  },
  {
    up: migration_20261018_093732_email_settings.up,
    down: migration_20261018_093732_email_settings.down,
    name: '20261018_093732_email_settings',
  },
  {
    up: migration_20261018_094315_emails_newsletter_picks.up,
    down: migration_20261018_094315_emails_newsletter_picks.down,
    name: '20261018_094315_emails_newsletter_picks',
  },
  {
    up: migration_20261018_100126_email_tagline.up,
    down: migration_20261018_100126_email_tagline.down,
    name: '20261018_100126_email_tagline',
  },
  {
    up: migration_20261018_102716_newsletter_sections.up,
    down: migration_20261018_102716_newsletter_sections.down,
    name: '20261018_102716_newsletter_sections',
  },
  {
    up: migration_20261018_102744_drop_newsletter_picks.up,
    down: migration_20261018_102744_drop_newsletter_picks.down,
    name: '20261018_102744_drop_newsletter_picks',
  },
  {
    up: migration_20261018_162245_picks_by_type_space_address.up,
    down: migration_20261018_162245_picks_by_type_space_address.down,
    name: '20261018_162245_picks_by_type_space_address',
  },
  {
    up: migration_20261018_165545_about_page_segment_setting.up,
    down: migration_20261018_165545_about_page_segment_setting.down,
    name: '20261018_165545_about_page_segment_setting',
  },
  {
    up: migration_20261018_174136_drop_about_page.up,
    down: migration_20261018_174136_drop_about_page.down,
    name: '20261018_174136_drop_about_page',
  },
  {
    up: migration_20261018_175500_backfill_publication_versions.up,
    down: migration_20261018_175500_backfill_publication_versions.down,
    name: '20261018_175500_backfill_publication_versions',
  },
  {
    up: migration_20261018_180514_card_stack_replaces_foreword.up,
    down: migration_20261018_180514_card_stack_replaces_foreword.down,
    name: '20261018_180514_card_stack_replaces_foreword',
  },
  {
    up: migration_20261018_183643_article_autosave.up,
    down: migration_20261018_183643_article_autosave.down,
    name: '20261018_183643_article_autosave',
  },
  {
    up: migration_20261018_192058_mailing_lists.up,
    down: migration_20261018_192058_mailing_lists.down,
    name: '20261018_192058_mailing_lists',
  },
  {
    up: migration_20261019_120000_accounts_get_a_person.up,
    down: migration_20261019_120000_accounts_get_a_person.down,
    name: '20261019_120000_accounts_get_a_person',
  },
  {
    up: migration_20261019_122625_review_for_courses_and_publications.up,
    down: migration_20261019_122625_review_for_courses_and_publications.down,
    name: '20261019_122625_review_for_courses_and_publications',
  },
  {
    up: migration_20261019_123324_applicant_questions_and_file_uploads.up,
    down: migration_20261019_123324_applicant_questions_and_file_uploads.down,
    name: '20261019_123324_applicant_questions_and_file_uploads',
  },
  {
    up: migration_20261019_131806_notifications.up,
    down: migration_20261019_131806_notifications.down,
    name: '20261019_131806_notifications',
  },
  {
    up: migration_20261019_140000_published_owners_are_public.up,
    down: migration_20261019_140000_published_owners_are_public.down,
    name: '20261019_140000_published_owners_are_public',
  },
  {
    up: migration_20261019_141427_navigation_switches.up,
    down: migration_20261019_141427_navigation_switches.down,
    name: '20261019_141427_navigation_switches',
  },
  {
    up: migration_20261019_224849_review_request.up,
    down: migration_20261019_224849_review_request.down,
    name: '20261019_224849_review_request',
  },
  {
    up: migration_20261021_152008_rename_spaces_to_places.up,
    down: migration_20261021_152008_rename_spaces_to_places.down,
    name: '20261021_152008_rename_spaces_to_places'
  },
];
