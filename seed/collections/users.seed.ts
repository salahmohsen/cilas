import type { Payload } from 'payload'
import type { SeedContext, UserSeed } from '../seed.type'
import { getOrCreateUser, lexical, requireId } from '../seed.utils'
import { coursesData } from './courses.seed'

export const usersData: UserSeed[] = [
  // ---- fellows (teach the courses below) ----
  {
    name: 'Karim El Dalil',
    name_ar: 'كريم الدليل',
    email: 'karim.eldalil@cilas.test',
    bio: 'A scriptwriter who worked as a writer and head writer in writing rooms for film and TV projects. Also a lecturer researching film history, and a film curator and programmer.',
    bio_ar:
      'كاتب سيناريو عمل ككاتب وكاتب رئيسي في غرف الكتابة لمشاريع سينمائية وتلفزيونية، وهو أيضًا محاضر يبحث في تاريخ السينما ومنسّق ومبرمج أفلام.',
    roles: ['fellow'],
  },
  {
    name: 'Mahāviveka',
    name_ar: 'ماهافيكا',
    email: 'mahaviveka@cilas.test',
    bio: 'A Theravāda monk (Shwegyin Nikaya, 2017) and scholar of Buddhist psychology, Sanskrit and Pāli. Author of "Motivation and Effort in Buddhist Soteriology" (2019) and "The Buddha as Messiah" (2025).',
    bio_ar:
      'راهب ثيرافادا (شويغين نيكايا، 2017) وعالم في علم النفس البوذي واللغتين السنسكريتية والبالية. مؤلف كتاب «الدافع والجهد في النجاة البوذية» (2019) و«البوذي بوصفه المسيح» (2025).',
    roles: ['fellow'],
  },
  {
    name: 'Yasser Abdellatif',
    name_ar: 'ياسر عبد اللطيف',
    email: 'yasser@cilas.test',
    bio: 'Egyptian writer, poet and translator; author of five story collections and four poetry collections, and a Sawiris laureate (2005, 2013).',
    bio_ar:
      'كاتب وشاعر ومترجم مصري، مؤلف خمس مجموعات قصصية وأربع مجموعات شعرية، وحائز جائزة الصفدي مرتين (2005، 2013).',
    roles: ['fellow'],
  },
  {
    name: 'Ahmad Mahana',
    name_ar: 'أحمد محانا',
    email: 'ahmad.mahana@cilas.test',
    bio: 'MA candidate in Sociology-Anthropology at AUC, focusing on Saint Catherine, South Sinai. Uses ethnographic fieldwork to explore ecological and sociological networks of the region’s sacred landscape.',
    bio_ar:
      'مرشّح لدرجة الماجستير في علم الاجتماع والأنثروبولوجيا بالجامعة الأمريكية بالقاهرة، حيث يركّز على منطقة سانت كاترين بجنوب سيناء. يستخدم البحث الميداني الإثنوغرافي لاستكشاف الشبكات البيئية والاجتماعية في المشهد المقدّس للمنطقة.',
    roles: ['fellow'],
  },

  // ---- advisors ----
  {
    name: 'Michael Brint',
    name_ar: 'مايكل برنت',
    email: 'michael.brint@cilas.test',
    bio: 'Professor of International Studies at California Lutheran University.',
    bio_ar: 'أستاذ الدراسات الدولية في جامعة كاليفورنيا لويثريان.',
    roles: ['ciliasian'],
  },
  {
    name: 'Teun Dekker',
    name_ar: 'تون ديكر',
    email: 'teun.dekker@cilas.test',
    bio: 'Associate Professor of Political Philosophy at University College Maastricht.',
    bio_ar: 'أستاذ مساعد للفلسفة السياسية في جامعة كوليج ماستريخت.',
    roles: ['ciliasian'],
  },
  {
    name: 'Yen-Chi Fan',
    name_ar: 'ينتشي فان',
    email: 'yenchi.fan@cilas.test',
    bio: 'Chair of Applied English at I-Shou University, Taiwan.',
    bio_ar: 'رئيس قسم الإنجليزية التطبيقية في جامعة إيشو في تايوان.',
    roles: ['ciliasian'],
  },
  {
    name: 'Abdul Hayy Lammert Holdijk',
    name_ar: 'عبد الحي لامرت هولدك',
    email: 'abdulhayy@cilas.test',
    bio: 'Associate Chair of Rhetoric and Composition at AUC.',
    bio_ar: 'رئيس مساعد قسم البلاغة والتأليف في الجامعة الأمريكية بالقاهرة.',
    roles: ['ciliasian'],
  },
  {
    name: 'Tommaso Vitale',
    name_ar: 'توماسو فيتالي',
    email: 'tommaso.vitale@cilas.test',
    bio: 'Associate Professor of Sociology at Sciences Po Paris.',
    bio_ar: 'أستاذ مساعد لعلم الاجتماع في العلوم السياسية باريس.',
    roles: ['ciliasian'],
  },

  // ---- trustees ----
  {
    name: 'Karim-Yassin Goessinger',
    name_ar: 'كريم ياسين جوسينجر',
    email: 'karim@cilas.test',
    bio: 'Founder of CILAS.',
    bio_ar: 'مؤسس مركز CILAS.',
    roles: ['ciliasian'],
  },
  {
    name: 'Amani Elshimi',
    name_ar: 'أماني الشيمي',
    email: 'amani.elshimi@cilas.test',
    bio: 'Director of Undergraduate Research at AUC.',
    bio_ar: 'مديرة أبحاث البكالوريوس في الجامعة الأمريكية بالقاهرة.',
    roles: ['ciliasian'],
  },
  {
    name: 'Ahmed Galal',
    name_ar: 'أحمد جلال',
    email: 'ahmed.galal@cilas.test',
    bio: 'Project Manager at Netsis Egypt.',
    bio_ar: 'مدير مشروع في مؤسسة نتسيس مصر.',
    roles: ['ciliasian'],
  },

  // ---- CILAS Translation Lab, 2016–2018 ----
  // Credited in "أعمال مختبر الترجمة" (CILAS, 2018), the volume of the five
  // articles seeded in `articles.seed.ts`. Supervision line (إشراف وتنسيق):
  // حسين الحاج، هند الغزالي، السيد محمود. All others are credited as
  // translators (ترجمة وتحرير) or reviewers (مراجعة).
  {
    name: 'Hussein El-Hag',
    name_ar: 'حسين الحاج',
    email: 'hussein.alhag@cilas.test',
    bio: 'Translation Lab supervisor and coordinator (إشراف وتنسيق), 2016–2018. Translator and reviewer on all five articles in "أعمال مختبر الترجمة" (CILAS, 2018).',
    bio_ar:
      'مشرف ومنسّق مختبر الترجمة بمركز CILAS (2016–2018)، ومترجم ومراجع للمقالات الخمسة جميعها في «أعمال مختبر الترجمة» (CILAS، 2018).',
    roles: ['ciliasian'],
  },
  {
    name: 'Hind El-Ghazaly',
    name_ar: 'هند الغزالي',
    email: 'hind.ghazaly@cilas.test',
    bio: 'Translation Lab supervisor and coordinator (إشراف وتنسيق), 2016–2018. Translator of "استعادة حريقنا في التعليم" in "أعمال مختبر الترجمة" (CILAS, 2018).',
    bio_ar:
      'مشرفة ومنسّقة مختبر الترجمة بمركز CILAS (2016–2018)، ومترجمة مقال «استعادة حريقنا في التعليم» في «أعمال مختبر الترجمة» (CILAS، 2018).',
    roles: ['ciliasian'],
  },
  {
    name: 'El-Sayed Mahmoud',
    name_ar: 'السيد محمود',
    email: 'sayid.mahmoud@cilas.test',
    bio: 'Translation Lab supervisor and coordinator (إشراف وتنسيق), 2016–2018. Translator of "التعافي من داء الدبلومات" and "استعادة حريقنا في التعليم".',
    bio_ar:
      'مشرف ومنسّق مختبر الترجمة بمركز CILAS (2016–2018)، ومترجم مقالَي «التعافي من داء الدبلومات» و«استعادة حريقنا في التعليم».',
    roles: ['ciliasian'],
  },
  {
    name: 'Iman Marak',
    name_ar: 'إيمان مراك',
    email: 'imani.marak@cilas.test',
    bio: 'Translator in the CILAS Translation Lab, 2016–2018. Lead translator of "حول كيفية قراءة الأعمال النظرية".',
    bio_ar:
      'مترجمة في مختبر الترجمة بمركز CILAS (2016–2018)، والمترجمة الرئيسية لمقال «حول كيفية قراءة الأعمال النظرية».',
    roles: ['ciliasian'],
  },
  {
    name: 'Ayman El-Husseini',
    name_ar: 'أيمن الحسيني',
    email: 'ayman.elhusseini@cilas.test',
    bio: 'Translator and reviewer in the CILAS Translation Lab, 2016–2018.',
    bio_ar: 'مترجم ومراجع في مختبر الترجمة بمركز CILAS (2016–2018).',
    roles: ['ciliasian'],
  },
  {
    name: 'Mad Bahi',
    name_ar: 'مد بحي',
    email: 'mad.bahi@cilas.test',
    bio: 'Translator in the CILAS Translation Lab, 2016–2018.',
    bio_ar: 'مترجم في مختبر الترجمة بمركز CILAS (2016–2018).',
    roles: ['ciliasian'],
  },
  {
    name: 'Nazihy Halouda',
    name_ar: 'نزيهة حلودة',
    email: 'nazihy.halouda@cilas.test',
    bio: 'Translator in the CILAS Translation Lab, 2016–2018. Translator of "استعادة حريقنا في التعليم".',
    bio_ar:
      'مترجمة في مختبر الترجمة بمركز CILAS (2016–2018)، ومترجمة مقال «استعادة حريقنا في التعليم».',
    roles: ['ciliasian'],
  },
  {
    name: 'Howaida Ahmed',
    name_ar: 'هويدة أحمد',
    email: 'howaida.ahmad@cilas.test',
    bio: 'Translator in the CILAS Translation Lab, 2016–2018. Translator of "حول كيفية قراءة الأعمال النظرية".',
    bio_ar:
      'مترجمة في مختبر الترجمة بمركز CILAS (2016–2018)، ومترجمة مقال «حول كيفية قراءة الأعمال النظرية».',
    roles: ['ciliasian'],
  },
  {
    name: 'Iman Kal Abdel Hamid',
    name_ar: 'إيمان كل عبد الحميد',
    email: 'imani.kal@cilas.test',
    bio: 'Translator and reviewer in the CILAS Translation Lab, 2016–2018. Sole translator of "القراءة والكتابة والفهم".',
    bio_ar:
      'مترجمة ومراجعة في مختبر الترجمة بمركز CILAS (2016–2018)، والمترجمة الوحيدة لمقال «القراءة والكتابة والفهم».',
    roles: ['ciliasian'],
  },
  {
    name: 'Ahmed El-Mengy',
    name_ar: 'أحمد colg',
    email: 'ahmed.elmengy@cilas.test',
    bio: 'Translator in the CILAS Translation Lab, 2016–2018. Lead translator of "استعادة حريقنا في التعليم".',
    bio_ar:
      'مترجم في مختبر الترجمة بمركز CILAS (2016–2018)، والمترجم الرئيسي لمقال «استعادة حريقنا في التعليم».',
    roles: ['ciliasian'],
  },
  {
    name: 'Islam Karam',
    name_ar: 'إسلام كرم',
    email: 'islam.karam@cilas.test',
    bio: 'Translator in the CILAS Translation Lab, 2016–2018. Translator of "استعادة حريقنا في التعليم".',
    bio_ar:
      'مترجم في مختبر الترجمة بمركز CILAS (2016–2018)، ومترجم مقال «استعادة حريقنا في التعليم».',
    roles: ['ciliasian'],
  },
  {
    name: 'Iman Safwat',
    name_ar: 'إيمان صفوت',
    email: 'imani.safwat@cilas.test',
    bio: 'Translator in the CILAS Translation Lab, 2016–2018. Translator of "استعادة حريقنا في التعليم".',
    bio_ar:
      'مترجمة في مختبر الترجمة بمركز CILAS (2016–2018)، ومترجمة مقال «استعادة حريقنا في التعليم».',
    roles: ['ciliasian'],
  },
  {
    name: 'Rehab Soliman',
    name_ar: 'رحاب سليمان',
    email: 'rehab.soliman@cilas.test',
    bio: 'Translator in the CILAS Translation Lab, 2016–2018. Translator of "استعادة حريقنا في التعليم".',
    bio_ar:
      'مترجمة في مختبر الترجمة بمركز CILAS (2016–2018)، ومترجمة مقال «استعادة حريقنا في التعليم».',
    roles: ['ciliasian'],
  },
  {
    name: 'Abdel Rahman Adel',
    name_ar: 'عبد الرحمن عادل',
    email: 'abdelrahman.adel@cilas.test',
    bio: 'Translator in the CILAS Translation Lab, 2016–2018. Translator of "استعادة حريقنا في التعليم".',
    bio_ar:
      'مترجم في مختبر الترجمة بمركز CILAS (2016–2018)، ومترجم مقال «استعادة حريقنا في التعليم».',
    roles: ['ciliasian'],
  },
  {
    name: 'Mariam Salem',
    name_ar: 'مريم سالم',
    email: 'mariam.salem@cilas.test',
    bio: 'Translator in the CILAS Translation Lab, 2016–2018. Translator of "استعادة حريقنا في التعليم".',
    bio_ar:
      'مترجمة في مختبر الترجمة بمركز CILAS (2016–2018)، ومترجمة مقال «استعادة حريقنا في التعليم».',
    roles: ['ciliasian'],
  },
  {
    name: 'Noura Halmy',
    name_ar: 'نورة حلمي',
    email: 'noura.halmy@cilas.test',
    bio: 'Translator in the CILAS Translation Lab, 2016–2018. Translator of "التعافي من داء الدبلومات".',
    bio_ar:
      'مترجمة في مختبر الترجمة بمركز CILAS (2016–2018)، ومترجمة مقال «التعافي من داء الدبلومات».',
    roles: ['ciliasian'],
  },
  {
    name: 'Sara Alaa',
    name_ar: 'سارة علاء',
    email: 'sara.alaa@cilas.test',
    bio: 'Translator in the CILAS Translation Lab, 2016–2018. Translator of "التعافي من داء الدبلومات".',
    bio_ar:
      'مترجمة في مختبر الترجمة بمركز CILAS (2016–2018)، ومترجمة مقال «التعافي من داء الدبلومات».',
    roles: ['ciliasian'],
  },
  {
    name: 'Amal Abdel Rahman',
    name_ar: 'أمل عبد الرحمن',
    email: 'amal.abdelrahman@cilas.test',
    bio: 'Translator in the CILAS Translation Lab, 2016–2018. Translator of "التعافي من داء الدبلومات".',
    bio_ar:
      'مترجمة في مختبر الترجمة بمركز CILAS (2016–2018)، ومترجمة مقال «التعافي من داء الدبلومات».',
    roles: ['ciliasian'],
  },
  {
    name: 'Heba El-Mansour',
    name_ar: 'هبة المنصور',
    email: 'heba.mansour@cilas.test',
    bio: 'Translator in the CILAS Translation Lab, 2016–2018. Translator of "التعافي من داء الدبلومات".',
    bio_ar:
      'مترجمة في مختبر الترجمة بمركز CILAS (2016–2018)، ومترجمة مقال «التعافي من داء الدبلومات».',
    roles: ['ciliasian'],
  },
  {
    name: 'Sara Salam',
    name_ar: 'سارة سلام',
    email: 'sara.salam@cilas.test',
    bio: 'Translator in the CILAS Translation Lab, 2016–2018. Translator of "التعافي من داء الدبلومات".',
    bio_ar:
      'مترجمة في مختبر الترجمة بمركز CILAS (2016–2018)، ومترجمة مقال «التعافي من داء الدبلومات».',
    roles: ['ciliasian'],
  },
  {
    name: 'Mohamed Nagu Senjer',
    name_ar: 'محمد ناجي سنجر',
    email: 'mohamed.nagu@cilas.test',
    bio: 'Translator in the CILAS Translation Lab, 2016–2018. Translator of "التعافي من داء الدبلومات".',
    bio_ar:
      'مترجم في مختبر الترجمة بمركز CILAS (2016–2018)، ومترجم مقال «التعافي من داء الدبلومات».',
    roles: ['ciliasian'],
  },
  {
    name: 'Amir Zaki',
    name_ar: 'أمير زكي',
    email: 'amir.zaki@cilas.test',
    bio: 'Reviewer (مراجعة) in the CILAS Translation Lab, 2016–2018, for "موجز تاريخ التعليم البديل" and "القراءة والكتابة والفهم".',
    bio_ar:
      'مراجع (مراجعة) في مختبر الترجمة بمركز CILAS (2016–2018) لمقالَي «موجز تاريخ التعليم البديل» و«القراءة والكتابة والفهم».',
    roles: ['ciliasian'],
  },
  {
    name: 'Nahir Emad',
    name_ar: 'نهير عماد',
    email: 'nahir.emad@cilas.test',
    bio: 'Reviewer (مراجعة) of "القراءة والكتابة والفهم" in the CILAS Translation Lab, 2016–2018.',
    bio_ar:
      'مراجِعة (مراجعة) لمقال «القراءة والكتابة والفهم» في مختبر الترجمة بمركز CILAS (2016–2018).',
    roles: ['ciliasian'],
  },
  {
    name: 'Nazihy Awad',
    name_ar: 'نزيهة عوض',
    email: 'nazihy.awad@cilas.test',
    bio: 'Translator in the CILAS Translation Lab, 2016–2018. Translator of "حول كيفية قراءة الأعمال النظرية".',
    bio_ar:
      'مترجمة في مختبر الترجمة بمركز CILAS (2016–2018)، ومترجمة مقال «حول كيفية قراءة الأعمال النظرية».',
    roles: ['ciliasian'],
  },
  {
    name: 'Amr Okasha',
    name_ar: 'عمرو عاشا',
    email: 'amr.okasha@cilas.test',
    bio: 'Cover designer (تصميم الغلاف) and art director (الإخراج الفني) of "أعمال مختبر الترجمة" (CILAS, 2018).',
    bio_ar:
      'مصمم الغلاف (تصميم الغلاف) والمخرج الفني (الإخراج الفني) لكتاب «أعمال مختبر الترجمة» (CILAS، 2018).',
    roles: ['ciliasian'],
  },

  // ---- admin ----
  {
    name: 'Salah Mohsen',
    name_ar: 'صلاح محسن',
    email: 'salahmmohsen@gmail.com',
    bio: 'FullStack Engineer',
    bio_ar: 'مهندس برمجيات متكامل (Full Stack).',
    roles: ['super_admin'],
    password: 'salahmmohsen@gmail.com',
  },
]

/**
 * Accounts are matched by email, so re-running never duplicates them and never
 * touches an existing password.
 *
 * Both locale passes update on every run, not only on create. getOrCreateUser
 * only creates, so a field that changed shape after the account was first seeded
 * (name and bio becoming localized) would otherwise stay empty forever.
 */
export const seedUsers = async (payload: Payload, ctx: SeedContext): Promise<void> => {
  for (const user of usersData) {
    const id = await getOrCreateUser(payload, user)
    ctx.users[user.email] = id

    // No password, so a real account's credentials survive.
    await payload.update({
      collection: 'users',
      id,
      data: { name: user.name, bio: lexical(user.bio), roles: user.roles },
      overrideAccess: true,
    })

    await payload.update({
      collection: 'users',
      id,
      data: { name: user.name_ar, bio: lexical(user.bio_ar, 'rtl') },
      locale: 'ar',
      overrideAccess: true,
    })

    console.log('user:', user.name)
  }
}

/**
 * Second pass. `users.field_of_study` points at a collection that does not exist
 * yet on the first pass, so it is derived from `coursesData`.
 *
 * Only `field_of_study` is written. `users.courses` is a virtual field derived
 * from `courses.fellows`, and the `fellow` role is granted by the Courses
 * `afterChange` hook, so neither belongs here.
 */
export const linkFellows = async (payload: Payload, ctx: SeedContext): Promise<void> => {
  const fieldByEmail = new Map<string, number>()

  for (const course of coursesData) {
    const fieldId = requireId(ctx.fieldsOfStudy, course.fields_of_study[0])
    for (const email of course.fellows) {
      fieldByEmail.set(email, fieldId)
    }
  }
}
