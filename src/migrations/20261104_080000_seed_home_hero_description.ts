import { type MigrateDownArgs, type MigrateUpArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    INSERT INTO site_settings_locales (_parent_id, _locale, hero_description)
    SELECT settings.id, copy.locale::"_locales", copy.description
    FROM site_settings AS settings
    CROSS JOIN (VALUES
      ('en', 'Since 2013, CILAS has invited people from all walks of life to study the liberal arts through a pedagogy of discovery, in seasonal courses and in the Bridge, a year-long programme. Knowledge is made together: in discussion and debate, workshops, field visits, music, cooking, laughing and listening.'),
      ('ar', 'منذ ٢٠١٣ يدعو سيلاس ناسًا من كل مسارات الحياة إلى دراسة الآداب والعلوم الحرة عبر بيداجوجيا الاكتشاف، في مقررات كل موسم وفي برنامج الجسر الممتد لعام كامل. هنا تُصنع المعرفة معًا: في النقاش والجدل، والورش، والزيارات الميدانية، والموسيقى، والطبخ، والضحك، والإصغاء.')
    ) AS copy(locale, description)
    ON CONFLICT (_locale, _parent_id) DO UPDATE
    SET hero_description = EXCLUDED.hero_description
    WHERE site_settings_locales.hero_description IS NULL;
  `)
}

export async function down(_args: MigrateDownArgs): Promise<void> {
  // Seeded descriptions are editable content and survive rollback.
}
