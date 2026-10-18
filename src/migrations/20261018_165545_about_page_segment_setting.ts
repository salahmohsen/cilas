import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "about" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"cover_id" integer,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "about_locales" (
  	"title" varchar NOT NULL,
  	"intro" varchar,
  	"body" jsonb,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  ALTER TABLE "email_settings" ADD COLUMN "segment_id" varchar;
  ALTER TABLE "about" ADD CONSTRAINT "about_cover_id_media_id_fk" FOREIGN KEY ("cover_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "about_locales" ADD CONSTRAINT "about_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."about"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "about_cover_idx" ON "about" USING btree ("cover_id");
  CREATE UNIQUE INDEX "about_locales_locale_parent_id_unique" ON "about_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "about_locales_parent_id_idx" ON "about_locales" USING btree ("_parent_id");`)

  // The About page's first text, from what the site already says about CILAS
  // (CONTEXT.md, the home page, the FAQ). The spaces render from their own
  // collection below it. Admins edit the text in Site → About page.
  for (const [locale, page] of Object.entries(ABOUT)) {
    await payload.updateGlobal({ slug: 'about', locale: locale as 'en' | 'ar', data: page as never, req, overrideAccess: true })
  }
}

type Inline = string | { text: string; url: string }
const text = (value: string) => ({ type: 'text', version: 1, text: value, format: 0, mode: 'normal', style: '', detail: 0 })
const inline = (part: Inline) =>
  typeof part === 'string'
    ? text(part)
    : {
        type: 'link',
        version: 3,
        fields: { linkType: 'custom', url: part.url, newTab: false },
        children: [text(part.text)],
        direction: null,
        format: '',
        indent: 0,
      }
const block = { direction: null, format: '', indent: 0, version: 1 }
const h2 = (value: string) => ({ ...block, type: 'heading', tag: 'h2', children: [text(value)] })
const p = (...parts: Inline[]) => ({ ...block, type: 'paragraph', textFormat: 0, textStyle: '', children: parts.map(inline) })
const ul = (...items: string[]) => ({
  ...block,
  type: 'list',
  listType: 'bullet',
  start: 1,
  tag: 'ul',
  children: items.map((item, i) => ({ ...block, type: 'listitem', value: i + 1, checked: undefined, children: [text(item)] })),
})
const root = (...children: object[]) => ({ root: { ...block, type: 'root', children } })

const ABOUT = {
  en: {
    title: 'About CILAS',
    intro:
      'The Cairo Institute of Liberal Arts and Sciences is an independent school in Cairo. Since 2013 it has invited people from all walks of life to study the liberal arts together: in seasonal courses, and in the Bridge, a year-long programme.',
    body: root(
      h2('What CILAS does'),
      p(
        'CILAS runs a cycle of courses each season: fall, winter, spring and summer. A cycle holds every kind of course: Core and Thematic courses, Labs, Workshops and Short courses. Most courses can be taken one at a time, without joining a programme. ',
        { text: 'See what is open', url: '/en/study' },
        '.',
      ),
      p(
        'The Bridge is CILAS’s year-long programme in the liberal arts. It spans the two semester cycles of one academic year and is made up of that year’s Core and Thematic courses and Labs. ',
        { text: 'Read about the Bridge', url: '/en/study/bridge' },
        '.',
      ),
      p(
        'CILAS also publishes the work of its community: essays, translations and collections by its students and fellows. ',
        { text: 'Read the articles', url: '/en/articles' },
        '.',
      ),
      h2('Who it is for'),
      ul(
        'High school graduates',
        'University walkouts',
        'Engineers and doctors',
        'Artists and organisers',
        'Wisdom seekers',
        'Anyone curious',
      ),
      p(
        'Anyone who has finished high school can apply. For the Bridge, a bachelor’s degree is recommended but not required. Single courses are open to everyone.',
      ),
      h2('How we teach'),
      p(
        'CILAS calls its way of teaching a pedagogy of discovery and attunement. Courses are taught by fellows and built on reading and discussion. Many discussions move between Arabic and English, and CILAS welcomes every kind of English. Instead of grades, fellows write a narrative of each student’s work.',
      ),
      h2('Paying for it'),
      p(
        'CILAS aims to be financially independent, sustained by the contributions of its students. Partial scholarships, based on need, are offered to a limited number of students; each programme’s page explains how to ask for one.',
      ),
      h2('Get in touch'),
      p('A question about a course or the Bridge? ', { text: 'Send us a message', url: '/en/contact' }, '.'),
    ),
  },
  ar: {
    title: 'عن سيلاس',
    intro:
      'معهد القاهرة للعلوم والآداب الحرة مدرسة مستقلة في القاهرة. منذ عام ٢٠١٣ يدعو أناسًا من كل الخلفيات إلى دراسة الآداب والعلوم الحرة معًا: في مقررات موسمية، وفي برنامج الجسر الذي يمتد عامًا كاملًا.',
    body: root(
      h2('ماذا يفعل سيلاس'),
      p(
        'يقدّم سيلاس دورة من المقررات كل موسم: الخريف والشتاء والربيع والصيف. تضم الدورة كل أنواع المقررات: المقررات الأساسية والموضوعية والمعامل وورش العمل والمقررات القصيرة. ويمكن أخذ معظم المقررات مقررًا مقررًا، دون الالتحاق ببرنامج. ',
        { text: 'اطّلع على المتاح الآن', url: '/ar/study' },
        '.',
      ),
      p(
        'الجسر هو برنامج سيلاس في الآداب والعلوم الحرة، ويمتد عامًا كاملًا. يشمل دورتي الفصلين الدراسيين في عام أكاديمي واحد، ويتكوّن من المقررات الأساسية والموضوعية والمعامل في ذلك العام. ',
        { text: 'اقرأ عن الجسر', url: '/ar/study/bridge' },
        '.',
      ),
      p(
        'ينشر سيلاس كذلك أعمال مجتمعه: مقالات وترجمات ومجموعات يكتبها طلابه وزملاؤه. ',
        { text: 'اقرأ المقالات', url: '/ar/articles' },
        '.',
      ),
      h2('لمن سيلاس'),
      ul(
        'لخريجي المدارس الثانوية',
        'لمن تركوا الجامعة',
        'للمهندسين والأطباء',
        'للفنانين والمنظِّمين',
        'للباحثين عن الحكمة',
        'لكل فضولي',
      ),
      p(
        'يمكن لكل من أنهى الدراسة الثانوية أن يتقدّم. يُستحسن الحصول على شهادة جامعية للالتحاق ببرنامج الجسر لكنها ليست شرطًا. والمقررات المنفردة مفتوحة للجميع.',
      ),
      h2('كيف نُدرِّس'),
      p(
        'يسمّي سيلاس طريقته في التعليم بيداجوجيا الاكتشاف والتناغم. يُدرِّس المقررات زملاء سيلاس، وتقوم على القراءة والنقاش. تتنقل نقاشات كثيرة بين العربية والإنجليزية، ويرحّب سيلاس بكل أشكال الإنجليزية. وبدلًا من الدرجات، يكتب الزملاء سردًا لعمل كل طالب.',
      ),
      h2('التمويل'),
      p(
        'يسعى سيلاس إلى الاستقلال المالي، ويقوم على مساهمات طلابه. وتُقدَّم منح جزئية بحسب الحاجة لعدد محدود من الطلاب، وتشرح صفحة كل برنامج كيف تطلبها.',
      ),
      h2('تواصل معنا'),
      p('عندك سؤال عن مقرر أو عن الجسر؟ ', { text: 'أرسل لنا رسالة', url: '/ar/contact' }, '.'),
    ),
  },
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "about" CASCADE;
  DROP TABLE "about_locales" CASCADE;
  ALTER TABLE "email_settings" DROP COLUMN "segment_id";`)
}
