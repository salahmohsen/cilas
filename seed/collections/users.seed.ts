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

  // ---- fall cycle 2025 fellows (short courses, from fall-cycle-2025) ----
  {
    name: 'Shadi Jamal',
    name_ar: 'شادي جمال',
    email: 'shadi.jamal@cilas.test',
    bio: "Born in Alexandria; taught physics and mathematics for eleven years at Collège Saint Marc, Alexandria. Now completing a master's in sociology (networks and communities) at the University of Toulouse. Active in Egyptian civil society in education, research and the social sciences; author of a 2023 handbook on teaching reading and writing, and winner of the 2024 Ahmed Bahaa El-Din Cultural Grant for «التعليم النقدي» (Critical Education).",
    bio_ar:
      'من مواليد الإسكندرية، عمل معلمًا للفيزياء والرياضيات أحد عشر عامًا في كلية سان مارك بالإسكندرية. يواصل حاليًا دراسة الماجستير في علم الاجتماع بتخصص الشبكات والمجتمعات بجامعة تولوز 2 بفرنسا. ناشط في المجتمع المدني المصري في مجالات التعليم والبحث والعلوم الاجتماعية والتربوية، وصدر له عام 2023 كتاب «دليل تعليم القراءة والكتابة»، وفاز عام 2024 بمنحة أحمد بهاء الدين الثقافية عن كتابه «التعليم النقدي».',
    roles: ['fellow'],
  },
  {
    name: 'George Bartlett',
    name_ar: 'جورج بارتلت',
    bio: 'A writer and lecturer working across cinema and psychoanalysis.',
    bio_ar: 'چورچ بارتلت كاتب ومحاضِر بيشتغل في مجال السينما والتحليل النفسي.',
    email: 'george.bartlett@cilas.test',
    roles: ['fellow'],
  },
  {
    name: 'S. Farwah Rizvi',
    name_ar: 'فرحة رضوي',
    email: 'farwah.rizvi@cilas.test',
    bio: 'A storyteller, theatre pedagogue and cultural researcher bridging performance, education and interdisciplinary scholarship. Teaching Fellow & Artistic Scholar at CILAS; MA in Theatre Arts (Middlesex University, London), pursuing an MA in Folklore and Culture Studies at IGNOU. Creator of Neo-Dastangoi and the proponent of Emotional Archaeology; co-writer and co-producer of the award-winning documentary In A Dissent Manner (2022).',
    bio_ar:
      'راوية ومربية مسرحية وباحثة ثقافية تعمل عند تقاطع الأداء والتعليم والدراسة البينية؛ زميلة تدريس وفن، ومبتكرة «الداستانغي الجديد» ومنهج «علم الآثار العاطفي»، ومؤلفة مشاركة في الفيلم الحائز على جائزة In A Dissent Manner (2022).',
    roles: ['fellow'],
  },
  {
    name: 'Evelyn Richardson',
    name_ar: 'إيفلين ريتشاردسون',
    email: 'evelyn.richardson@cilas.test',
    bio: 'PhD in Comparative Literature from the University of Chicago, where he also spent two years as a humanities teaching fellow. Currently a private tutor of Latin and ancient Greek.',
    bio_ar:
      'حاصل على دكتوراه في الأدب المقارن من جامعة شيكاغو، حيث عمل أيضًا مدرّسًا في قسم الآداب لمدة سنتين. يعمل حاليًا مدرّسًا خاصًّا للغتين اللاتينية واليونانية القديمة.',
    roles: ['fellow'],
  },
  {
    name: 'Mina Nagy',
    name_ar: 'مينا ناجي',
    email: 'mina.nagy@cilas.test',
    bio: 'Egyptian writer and translator. Latest work: ليس عزاءً، بل ضوءًا (2025), on the thought and philosophy of Simone Weil; translated Dante’s De vulgari eloquentia (2024) and Žižek’s ضد الابتزاز المزدوج (2022), for which he won the State Encouragement Award. Has run seven Creative Nonfiction writing workshops since late 2022.',
    bio_ar:
      'كاتب ومترجم مصري. أحدث أعماله «ليس عزاءً، بل ضوءًا: في استلهام فكر وفلسفة سيمون فاي» (2025)، وترجم «عن بلاغة العامية» (2024) لدانتي أليجييري، و«ضد الابتزاز المزدوج» (2022) لسلافوي جيجك الحائز على جائزة الدولة التشجيعية، وأقام سبع دورات من ورشة الكتابة الإبداعية غير الخيالية منذ نهاية 2022.',
    roles: ['fellow'],
  },

  // ---- winter cycle 2026 fellows ----
  {
    name: 'Susanne Sklar',
    name_ar: 'سوزان سكلر',
    email: 'susanne.sklar@cilas.test',
    bio: 'Has taught humanities — literature, religion and performance — in China, Russia, Sweden, the USA and the UK (at Oxford, where she received her doctorate). Published over twenty articles and the book Blake’s Jerusalem As Visionary Theatre; also a peace researcher, actress and social worker who created arts programmes for Chicago teenagers who had been homeless and abused.',
    bio_ar:
      'درّست العلوم الإنسانية — الأدب والدين وفنون الأداء — في الصين وروسيا والسويد والولايات المتحدة وبريطانيا (حيث نالت الدكتوراه من أكسفورد)، ونشرت أكثر من عشرين مقالًا وكتاب «Blake’s Jerusalem As Visionary Theatre»، وعملت بأبحاث سلام وفنون تناول الشباب المشردين في شيكاغو.',
    roles: ['fellow'],
  },
  {
    name: 'Leon Conrad',
    name_ar: 'ليون كونراد',
    email: 'leon.conrad@cilas.test',
    bio: 'Founder of The Unknown Storyteller Project, founder/lead tutor at The Traditional Tutor, co-founder/lead trainer at The Academy of Oratory, and affiliate at the KSU Next Society Institute, Lithuania. Author of Story and Structure (2022, People’s Book Prize finalist) and Master the Art and Craft of Writing (2024). Grew up in Alexandria, Egypt.',
    bio_ar:
      'مؤسس مشروع الحكّاين المجهول («The Unknown Storyteller Project») وأكاديمية المنبر للخطابة، وأفلييت في معهد Next Society بجامعة الملك سعود؛ مؤلف كتابَي Story and Structure (2022) وMaster the Art and Craft of Writing (2024)، ونشأ في الإسكندرية حيث أنشأت تجارب الحكاية الشفوية شغفه مدى الحياة باللغة.',
    roles: ['fellow'],
  },
  {
    name: 'Ghosoun Ismail',
    name_ar: 'غصون إسماعيل',
    email: 'ghosoun.ismail@cilas.test',
    bio: 'Holds a Master’s in Independent School Leadership from Teachers College, Columbia University, and a Master’s in Sociology and Anthropology from AUC. Researcher and educator focused on education systems, social inequality, and the relationship between schooling, class and belonging in Egypt.',
    bio_ar:
      'تحمل درجة ماجستير في قيادة المدارس المستقلة من كلية المعلمين بجامعة كولومبيا، وماجستير في علم الاجتماع والأنثروبولوجيا من الجامعة الأمريكية بالقاهرة. باحثة ومربية تعمل في نظم التعليم، وعدم المساواة الاجتماعية، وعلاقة التعليم بالطبقة والانتماء في مصر.',
    roles: ['fellow'],
  },
  {
    name: 'Zeina Ali',
    name_ar: 'زينة علي',
    email: 'zeina.ali@cilas.test',
    bio: 'An academic with degrees in political science and international human rights law and justice (BA and MA, AUC). Her intellectual practice is shaped by anthropology, history and comparative religions, and situates itself at the nexus of critical legal studies and post-structuralist thought; her MA thesis examined the limits of human rights law through questions of Indigenous sovereignty and incommensurability.',
    bio_ar:
      'أكاديمية تحمل درجتي بكالوريوس في العلوم السياسية وماجستير في القانون الدولي لحقوق الإنسان والعدالة من الجامعة الأمريكية بالقاهرة. تمتد ممارستها الفكرية بين الدراسات القانونية النقدية والفكر ما بعد البنيوي، وتقارين رسالتها حدود القانون الدولي لحقوق الإنسان عبر أسئلة سيادة الشعوب الأصلية والعدم القابلية للقياس.',
    roles: ['fellow'],
  },
  {
    name: 'Osama Amer',
    name_ar: 'أسامة عامر',
    email: 'osama.amer@cilas.test',
    bio: 'A researcher and writer; won the Magda Al-Nowaihi award in Gender Studies (2025) for his AUC MA thesis in Arabic Literature & Language, “Negotiating the Canon: Arab Women Romantic Poets Jamila al-ʻAlayli and Zahra al-Hurr”. His short story «فرخة» won the Madalyn Lamont award in creative writing (2023). Interested in writing about the daily and the mundane.',
    bio_ar:
      'باحث وكاتب؛ فاز بجائزة ماجدة النواحي في دراسات الجندر (2025) عن رسالة الماجستير في الأدب العربي «التفاوض على الكانون: الشاعرات الرومانسيات جميلة العليلي وزهرة الحر» من الجامعة الأمريكية بالقاهرة، وفازت قصته القصيرة «فرخة» بجائزة مادلين لامونت في الكتابة الإبداعية (2023). مهتم بالكتابة عن اليومي والعادي.',
    roles: ['fellow'],
  },

  // ---- Pigeon Towers essayists (authors of the essay collection) ----
  {
    name: 'Surti Singh',
    name_ar: 'سورتي سينغ',
    email: 'surti.singh@cilas.test',
    bio: 'Assistant Professor of Philosophy at the American University in Cairo. Specializes in 20th-century Continental Philosophy, Critical Theory, Aesthetics and Feminism; recent work explores aesthetics from early critical theory, and theories of the image within psychoanalysis, phenomenology and social theory.',
    bio_ar:
      'أستاذة مساعدة للفلسفة بالجامعة الأمريكية بالقاهرة، متخصصة في الفلسفة القارية والنظرية النقدية والجمالية والنظرية النسوية، وقد نشرت في أنطولوجيا (The Aesthetic Ground of Critical Theory) وغيرها.',
    roles: ['ciliasian'],
  },
  {
    name: 'I-Kai Jeng',
    name_ar: 'إيكاي چانغ',
    email: 'ikai.jeng@cilas.test',
    bio: 'Received his PhD/MA in Philosophy and Classical Studies at Boston University; visiting fellow at CILAS for a trimester. Now in the Department of Philosophy, National Taiwan University, and a specialist in Greek philosophy — especially Plato on philosophical engagement in politics and the character of philosophical discourse.',
    bio_ar:
      'حاصل على الدكتوراه والماجستير في الفلسفة والدراسات الكلاسيكية من جامعة بوسطن، وكان زميل زيارته في CILAS لفصل دراسي. يعمل اليوم في قسم الفلسفة بجامعة تايوان الوطنية، ومتخصص في الفلسفة الإغريقية، خصوصًا أفلاطون.',
    roles: ['ciliasian'],
  },
  {
    name: 'Robin Weiss',
    name_ar: 'روبن فايس',
    email: 'robin.weiss@cilas.test',
    bio: 'Received her PhD from DePaul University, and taught most recently at Mount Allison University in Canada. Specializes in ancient Greek and Roman philosophy — Roman Stoicism in particular, where it relates the connection between thought and action.',
    bio_ar:
      'حاصلة على الدكتوراه من جامعة ديبول، وآخر تدريسها في جامعة ماونت أليسون بكندا. متخصصة في الفلسفة الإغريقية والرومانية القديمة، وفي الرواقية الرومانية وعلاقة الفكر بالفعل.',
    roles: ['ciliasian'],
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
    bio: 'Vice-Dean of Academic Affairs and Professor of Liberal Arts and Sciences Education at University College Maastricht; did his BA at University College Utrecht, completed graduate studies in political philosophy at Oxford (desert-based theories of distributive justice) and continued at Yale. Teaches political philosophy and writes about the educational philosophy behind LAS education.',
    bio_ar:
      'نائب عميد الشؤون الأكاديمية وأستاذ تربية العلوم والآداب الحرة بجامعة كولج ماستريخت؛ نال البكالوريوس من يوترخت ودراساته العليا في الفلسفة السياسية من أكسفورد ثم ييل، وتعلّم الفلسفة السياسية ويكتب عن فلسفة تعليم العلوم والآداب الحرة.',
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
 * `users.courses` is a virtual field derived from `courses.fellows`, and the
 * `fellow` role is granted by the Courses `afterChange` hook — neither belongs
 * in the user seeder.
 */
export const linkFellows = async (payload: Payload, ctx: SeedContext): Promise<void> => {
  for (const course of coursesData) {
    for (const email of course.fellows) {
      if (ctx.users[email] === undefined) {
        throw new Error(`seed: course fellow "${email}" not seeded before courses`)
      }
    }
  }
}
