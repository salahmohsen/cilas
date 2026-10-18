import type { Payload } from 'payload'
import type { SeedContext, UserSeed } from '../seed.type'
import { slugify } from '@/lib/slugify'
import { getOrCreateId, getOrCreateUser, lexical } from '../seed.utils'
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
    name: 'George Louis Bartlett',
    name_ar: 'جورج بارتلت',
    bio: 'A writer and lecturer working across cinema and psychoanalysis.',
    bio_ar: 'چورچ بارتلت كاتب ومحاضِر بيشتغل في مجال السينما والتحليل النفسي.',
    email: 'georgelouisbartlett@gmail.com',
    roles: ['fellow'],
  },
  {
    name: 'S. Farwah Rizvi',
    name_ar: 'فرحة رضوي',
    email: 's.farwah.rizvi@gmail.com',
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
    email: 'susanne.sklar@gmail.com',
    bio: 'Has taught humanities — literature, religion and performance — in China, Russia, Sweden, the USA and the UK (at Oxford, where she received her doctorate). Published over twenty articles and the book Blake’s Jerusalem As Visionary Theatre; also a peace researcher, actress and social worker who created arts programmes for Chicago teenagers who had been homeless and abused.',
    bio_ar:
      'درّست العلوم الإنسانية — الأدب والدين وفنون الأداء — في الصين وروسيا والسويد والولايات المتحدة وبريطانيا (حيث نالت الدكتوراه من أكسفورد)، ونشرت أكثر من عشرين مقالًا وكتاب «Blake’s Jerusalem As Visionary Theatre»، وعملت بأبحاث سلام وفنون تناول الشباب المشردين في شيكاغو.',
    roles: ['fellow'],
  },
  {
    name: 'Leon Conrad',
    name_ar: 'ليون كونراد',
    email: 'leon@traditionaltutor.co.uk',
    website: 'https://www.traditionaltutor.co.uk',
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
    email: 'osamaamer@aucegypt.edu',
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
    // The book's own contributor note (English and Arabic editions).
    bio: 'Surti Singh is an Assistant Professor of Philosophy at the American University in Cairo. She specializes in 20th Century Continental Philosophy, Critical Theory, Aesthetics, and Feminism. Her recent work explores issues in aesthetics from the vantage point of early critical theory; theories of the image and the imaginary within the framework of psychoanalysis, phenomenology, and social theory; and feminist approaches to subjectivity. Her work has appeared in The Aesthetic Ground of Critical Theory: New Readings of Benjamin and Adorno (Rowman and Littlefield: 2015), New Forms of Revolt: Essays on Kristeva’s Intimate Politics (SUNY: 2017), and is forthcoming in Subjectivity and the Political (Routledge: 2017).',
    bio_ar:
      'سورتي سينغ هي أستاذة مساعدة في الفلسفة في الجامعة الأمريكية بالقاهرة. تخصصت في فلسفة القرن العشرين القارية الأوروبية والنظرية النقدية وفلسفة الجمال والنسوية. تستكشف أعمالها الحديثة موضوعات في فلسفة الجمال من وجهة نظر النظرية النقدية المبكرة، ونظريات الصورة والخيال في إطار التحليل النفسي والفينومينولوجيا والنظرية الاجتماعية، والمقاربات النسوية للذاتية.',
    roles: ['member'],
  },
  {
    name: 'I-Kai Jeng',
    name_ar: 'إي-كاي جنيج',
    email: 'qtaroj@gmail.com',
    // The book's own contributor note (English and Arabic editions).
    bio: "I-Kai Jeng received his PhD/MA in Philosophy and Classical Studies at Boston University. Before going back home and taking up a position in the Department of Philosophy, National Taiwan University, he was visiting fellow at CILAS for a trimester and shared his thoughts on Plato's Republic with the wonderful people there. He is a specialist in Greek philosophy, with special concentration on Plato's reflections on the philosophical engagement in politics and the character of philosophical discourse. He enjoys tennis (only theorizing, no practice!), cinema, and folding paper when he's not unfolding concepts.",
    bio_ar:
      'تلقى إي-كاي جنيج درجة الماجستير والدكتوراة في الفلسفة والدراسات الكلاسيكية في جامعة بوسطن، قبل أن يعود إلى بلاده ويتقلد منصباً في قسم الفلسفة بجامعة تايوان الوطنية، وقد عمل كزميل أكاديمي زائر في سيلاس لفصل دراسي واحد وشارك أفكاره حول جمهورية أفلاطون مع طلابها الرائعين هناك. وهو متخصص في الفلسفة اليونانية، مع تركيز خاص على تأملات أفلاطون عن الانخراط الفلسفي في السياسية وطبيعة الخطاب الفلسفي، كما يستمتع بلعبة التنس (نظريًا فقط، وليست الممارسة!) والسينما وطي الورق عندما لا يكون منشغلاً بإيضاح المفاهيم.',
    roles: ['member'],
  },
  {
    name: 'Robin Weiss',
    name_ar: 'روبن فايس',
    email: 'robin.weiss@cilas.test',
    // The book's own contributor note (English and Arabic editions).
    bio: 'Robin Weiss received her Ph.D. from DePaul University, and taught most recently at Mount Allison University in Canada. She specializes in ancient Greek and Roman Philosophy, and in Roman Stoicism in particular, where it relates to the connection between thought and action. She has written on how the Stoics understood practical, as opposed to theoretical, intelligence, and also how it was understood by their predecessor, Aristotle. Her interests extend to the differing ways in which this connection has been taken up by subsequent thinkers, who have variously described it—in the traditions of Continental Philosophy and American Pragmatism—as the connection between knowing and doing, truth and subjectivity, theory and praxis.',
    bio_ar:
      'حصلت روبن فايس على درجة الدكتوراة من جامعة دي بول، ودرست مؤخرًا في جامعة ماونت آليسون في كندا، وتخصصت في الفلسفة اليونانية والرومانية القديمة، وتحديدًا في الرواقية الرومانية، من حيث تعلقها في الإتصال بين الفكر والفعل. كتبت عن كيفية فهم الرواقيون للذكاء العملي بصفته مناقضًا للذكاء النظري، وأيضًا كيف فهمها من سلفهم، مثل أرسطو. يمتد اهتمامها في الشعب المختلفة التي اتخذ فيها مفكرون لاحقون تلك الرابطة بصفتها رابطة بين المعرفة والفعل والحقيقة والذاتية والنظرية والممارسة ووصفوها بطرق متنوعة في تقاليد الفلسفة القارية الأوروبية والذرائعية الأمريكية.',
    roles: ['member'],
  },

  // ---- advisors ----
  {
    name: 'Michael Brint',
    name_ar: 'مايكل برنت',
    email: 'michael.brint@cilas.test',
    bio: 'Professor of International Studies at California Lutheran University.',
    bio_ar: 'أستاذ الدراسات الدولية في جامعة كاليفورنيا لويثريان.',
    roles: ['member'],
  },
  {
    name: 'Teun Dekker',
    name_ar: 'تُن جي. ديكر',
    email: 'teun.dekker@cilas.test',
    // The book's own contributor note (English and Arabic editions).
    bio: 'Teun J. Dekker is Vice-Dean of Academic Affairs and Professor of Liberal Arts and Sciences Education at University College Maastricht. He did his BA at University College Utrecht, the first liberal arts college in the Netherlands, and has been a staunch advocate of liberal arts education ever since. He completed his graduate studies in political philosophy at Oxford University, focussing on desert-based theories of distributive justice, and continued this research at Yale University. At University College Maastricht, he teaches courses in political philosophy, and writes about the educational philosophy behind Liberal Arts and Sciences education.',
    bio_ar:
      'تُن جي. ديكر هو نائب عميد الشئون الأكاديمية وأستاذ تعليم العلوم والآداب الحرة في كلية ماستريخت الجامعية. وقد حصل على درجة بكالوريوس في الآداب من كلية أوتريخت الجامعية، وهي أول جامعة للآداب الحرة في هولندا، ومنذ ذلك الوقت أصبح مناديًا متحمسًا لتعليم الآداب الحرة. أكمل دراساته العليا في الفلسفة السياسية في جامعة أوكسفورد مركّزًا على نظريات البداوة للعدالة التوزيعية، ثم أكمل بحوثه في جامعة ييل. يُدرس تُن مساقات في كلية ماستريخت الجامعية ويكتب عن الفلسفة التعليمية خلف تعليم العلوم والآداب الحرة.',
    roles: ['member'],
  },
  {
    name: 'Yen-Chi Fan',
    name_ar: 'ينتشي فان',
    email: 'yenchi.fan@cilas.test',
    bio: 'Chair of Applied English at I-Shou University, Taiwan.',
    bio_ar: 'رئيس قسم الإنجليزية التطبيقية في جامعة إيشو في تايوان.',
    roles: ['member'],
  },
  {
    name: 'Abdul Hayy Lammert Holdijk',
    name_ar: 'عبد الحي لامرت هولدك',
    email: 'abdulhayy@cilas.test',
    bio: 'Associate Chair of Rhetoric and Composition at AUC.',
    bio_ar: 'رئيس مساعد قسم البلاغة والتأليف في الجامعة الأمريكية بالقاهرة.',
    roles: ['member'],
  },
  {
    name: 'Tommaso Vitale',
    name_ar: 'توماسو فيتالي',
    email: 'tommaso.vitale@cilas.test',
    bio: 'Associate Professor of Sociology at Sciences Po Paris.',
    bio_ar: 'أستاذ مساعد لعلم الاجتماع في العلوم السياسية باريس.',
    roles: ['member'],
  },

  // ---- trustees ----
  {
    name: 'Karim-Yassin Goessinger',
    name_ar: 'كريم ياسين جوسنجر',
    email: 'karim@ci-las.org',
    // The book's own contributor note (English and Arabic editions).
    bio: 'Karim-Yassin Goessinger studied political philosophy and urbanism in the Netherlands, Brazil and France. He worked with different development agencies in Latin America and the Middle East in fields including micro-finance, informal housing and local governance. A Dalai Lama and Donella Meadows Fellow, he enjoys martial arts, languages, world music, cooking and tea. After his graduate studies at Sciences Po Paris, he founded the Cairo Institute of Liberal Arts and Sciences (CILAS). At CILAS, he has coordinated the field of study Social Sciences and has directed the yearlong study programme in the liberal arts between 2013 and 2016. At the American University in Cairo, he convened two sociology courses in 2016 and 2017.',
    bio_ar:
      'درس كريم ياسين جوسنجر الفلسفة السياسية والعمران في هولندا والبرازيل وفرنسا وعمل في عدة مؤسسات تنموية في أمريكا اللاتينية والشرق الأوسط في حقول التمويل المتناهي الصغر والإسكان الشعبي والحوكمة المحلية. يستمتع بالفنون القتالية واللغات والموسيقى العالمية والطبخ والشاي. بعد تخرجه من جامعة ساينس بو باريس، أنشأ معهد القاهرة للعلوم والآداب الحرة (سيلاس). نسق حقل العلوم الإجتماعية والطبيعية في سيلاس وأدار برنامج العام الدراسي في الآداب الحرة بين عام 2013 و2016، كما درّس مساقين في علم الإجتماع في الجامعة الأمريكية بالقاهرة في عامي 2016 و2017.',
    roles: ['member'],
  },
  {
    name: 'Amani Elshimi',
    name_ar: 'أماني الشيمي',
    email: 'amani.elshimi@cilas.test',
    bio: 'Director of Undergraduate Research at AUC.',
    bio_ar: 'مديرة أبحاث البكالوريوس في الجامعة الأمريكية بالقاهرة.',
    roles: ['member'],
  },
  {
    name: 'Ahmed Galal',
    name_ar: 'أحمد جلال',
    email: 'ahmed.galal@cilas.test',
    bio: 'Project Manager at Netsis Egypt.',
    bio_ar: 'مدير مشروع في مؤسسة نتسيس مصر.',
    roles: ['member'],
  },

  {
    name: 'Hussein El-Hag',
    name_ar: 'حسين الحاج',
    email: 'sheikh.kamar@gmail.com',
    // The book's own contributor note (English and Arabic editions).
    bio: 'Hussein El Hajj is a graduate of the Faculty of Arts in the Department of English at Cairo University. While at college, he began reciting poems, acting in plays and short movies, writing and translating poetry, articles, and short stories published in print and in online magazines, as well as keeping a personal blog. The transition from the arts to deep socio-political issues after the revolution was what brought him to CILAS in 2014.',
    bio_ar:
      'تخرج حسين الحاج من كلية الآداب قسم اللغة الإنجليزية بجامعة القاهرة. أثناء سنوات الدراسة، اهتم بإلقاء الشعر والتمثيل في المسرحيات والأفلام القصيرة وكتابة وترجمة الشعر والمقالات والقصص القصيرة التي نشرها في المواقع والمدونات الإلكترونية. والتحول الذي مرر به من عالم الفنون إلى الموضوعات السياسية الإجتماعية بعد الثورة هو الذي دفعه للإلتحاق بسيلاس في 2014.',
    roles: ['member'],
  },

  // ---- CILAS Translation Lab, 2016–2018 ----
  // Credited in "الترجمة بصفتها تعليمًا: أعمال مختبر الترجمة" (CILAS, 2018). Names
  // and roles as the booklet prints them (its imprint and each essay's title
  // page); Latin spellings match migration/aliases.json so the archive import
  // finds the same people. Hussein El-Hag is with the Pigeon Towers contributors.
  {
    name: 'Hend El Ghazaly',
    name_ar: 'هند الغزالي',
    email: 'hind.ghazaly@cilas.test',
    bio: 'Supervision and coordination of the CILAS Translation Lab, and a translator of "Reclaiming Our Freedom to Learn", in "Translation as Education: Works of the Translation Lab" (CILAS, 2018).',
    bio_ar:
      'إشراف وتنسيق مختبر الترجمة بسيلاس، وشاركت في ترجمة «استعادة حريتنا في التعلم»، في «الترجمة بصفتها تعليمًا: أعمال مختبر الترجمة» (سيلاس، 2018).',
    roles: ['member'],
  },
  {
    name: 'El-Sayed Mahmoud',
    name_ar: 'السيد محمود',
    email: 'sayid.mahmoud@cilas.test',
    bio: 'Supervision and coordination of the CILAS Translation Lab, and a translator of "Healing Ourselves from the Diploma Disease" and "Reclaiming Our Freedom to Learn", in "Translation as Education: Works of the Translation Lab" (CILAS, 2018).',
    bio_ar:
      'إشراف وتنسيق مختبر الترجمة بسيلاس، وشارك في ترجمة «التعافي من داء الدبلومات» و«استعادة حريتنا في التعلم»، في «الترجمة بصفتها تعليمًا: أعمال مختبر الترجمة» (سيلاس، 2018).',
    roles: ['member'],
  },
  {
    name: 'Eman Maarek',
    name_ar: 'إيمان معارك',
    email: 'imani.marak@cilas.test',
    bio: 'A translator of "On Reading and Not Reading Theoretical Works" in "Translation as Education: Works of the Translation Lab" (CILAS, 2018).',
    bio_ar:
      'شاركت في ترجمة «حول كيفية قراءة الأعمال النظرية» في «الترجمة بصفتها تعليمًا: أعمال مختبر الترجمة» (سيلاس، 2018).',
    roles: ['member'],
  },
  {
    name: 'Ayman El-Husseini',
    name_ar: 'أيمن الحسيني',
    email: 'ayman.elhusseini@cilas.test',
    bio: 'Translator of "A Brief History of Alternative Education", a translator of "On Reading and Not Reading Theoretical Works", and a reviewer of "Reading, Writing, and Understanding", in "Translation as Education: Works of the Translation Lab" (CILAS, 2018).',
    bio_ar:
      'ترجم «موجز تاريخ التعليم البديل»، وشارك في ترجمة «حول كيفية قراءة الأعمال النظرية» ومراجعة «القراءة والكتابة والفهم»، في «الترجمة بصفتها تعليمًا: أعمال مختبر الترجمة» (سيلاس، 2018).',
    roles: ['member'],
  },
  {
    name: 'Mohamed Yahya',
    name_ar: 'محمد يحيي',
    email: 'mohamed.yahya@cilas.test',
    bio: 'A translator of "On Reading and Not Reading Theoretical Works" in "Translation as Education: Works of the Translation Lab" (CILAS, 2018).',
    bio_ar:
      'شارك في ترجمة «حول كيفية قراءة الأعمال النظرية» في «الترجمة بصفتها تعليمًا: أعمال مختبر الترجمة» (سيلاس، 2018).',
    roles: ['member'],
  },
  {
    name: 'Nazih Hallouda',
    name_ar: 'نزيه هلوده',
    email: 'nazihy.halouda@cilas.test',
    bio: 'A translator of "Reclaiming Our Freedom to Learn" in "Translation as Education: Works of the Translation Lab" (CILAS, 2018).',
    bio_ar:
      'شارك في ترجمة «استعادة حريتنا في التعلم» في «الترجمة بصفتها تعليمًا: أعمال مختبر الترجمة» (سيلاس، 2018).',
    roles: ['member'],
  },
  {
    name: 'Howaida Ahmed',
    name_ar: 'هويدا أحمد',
    email: 'howaida.ahmad@cilas.test',
    bio: 'A translator of "On Reading and Not Reading Theoretical Works" in "Translation as Education: Works of the Translation Lab" (CILAS, 2018).',
    bio_ar:
      'شاركت في ترجمة «حول كيفية قراءة الأعمال النظرية» في «الترجمة بصفتها تعليمًا: أعمال مختبر الترجمة» (سيلاس، 2018).',
    roles: ['member'],
  },
  {
    name: 'Eman Abdelhamid Kamal',
    name_ar: 'إيمان كمال عبد الحميد',
    email: 'imani.kal@cilas.test',
    bio: 'Translator of "Reading, Writing, and Understanding" and a reviewer of "A Brief History of Alternative Education", in "Translation as Education: Works of the Translation Lab" (CILAS, 2018).',
    bio_ar:
      'ترجمت «القراءة والكتابة والفهم» وشاركت في مراجعة «موجز تاريخ التعليم البديل»، في «الترجمة بصفتها تعليمًا: أعمال مختبر الترجمة» (سيلاس، 2018).',
    roles: ['member'],
  },
  {
    name: 'Ahmed Mongey',
    name_ar: 'أحمد المنجي',
    email: 'ahmed.elmengy@cilas.test',
    bio: 'A translator of "Reclaiming Our Freedom to Learn" in "Translation as Education: Works of the Translation Lab" (CILAS, 2018).',
    bio_ar:
      'شارك في ترجمة «استعادة حريتنا في التعلم» في «الترجمة بصفتها تعليمًا: أعمال مختبر الترجمة» (سيلاس، 2018).',
    roles: ['member'],
  },
  {
    name: 'Islam Karrar',
    name_ar: 'إسلام كرّار',
    email: 'islam.karam@cilas.test',
    bio: 'A translator of "Reclaiming Our Freedom to Learn" in "Translation as Education: Works of the Translation Lab" (CILAS, 2018).',
    bio_ar:
      'شارك في ترجمة «استعادة حريتنا في التعلم» في «الترجمة بصفتها تعليمًا: أعمال مختبر الترجمة» (سيلاس، 2018).',
    roles: ['member'],
  },
  {
    name: 'Iman Safwat',
    name_ar: 'إيمان صفوت',
    email: 'imani.safwat@cilas.test',
    bio: 'A translator of "Reclaiming Our Freedom to Learn" in "Translation as Education: Works of the Translation Lab" (CILAS, 2018).',
    bio_ar:
      'شاركت في ترجمة «استعادة حريتنا في التعلم» في «الترجمة بصفتها تعليمًا: أعمال مختبر الترجمة» (سيلاس، 2018).',
    roles: ['member'],
  },
  {
    name: 'Rehab Suleiman',
    name_ar: 'رحاب سليمان',
    email: 'rehab.soliman@cilas.test',
    bio: 'A translator of "Reclaiming Our Freedom to Learn" in "Translation as Education: Works of the Translation Lab" (CILAS, 2018).',
    bio_ar:
      'شاركت في ترجمة «استعادة حريتنا في التعلم» في «الترجمة بصفتها تعليمًا: أعمال مختبر الترجمة» (سيلاس، 2018).',
    roles: ['member'],
  },
  {
    name: 'Abdel Rahman Adel',
    name_ar: 'عبد الرحمن عادل',
    email: 'abdelrahman.adel@cilas.test',
    bio: 'A translator of "Reclaiming Our Freedom to Learn" in "Translation as Education: Works of the Translation Lab" (CILAS, 2018).',
    bio_ar:
      'شارك في ترجمة «استعادة حريتنا في التعلم» في «الترجمة بصفتها تعليمًا: أعمال مختبر الترجمة» (سيلاس، 2018).',
    roles: ['member'],
  },
  {
    name: 'Mariam Sameh',
    name_ar: 'مريم سامح',
    email: 'mariam.salem@cilas.test',
    bio: 'A translator of "Reclaiming Our Freedom to Learn" in "Translation as Education: Works of the Translation Lab" (CILAS, 2018).',
    bio_ar:
      'شاركت في ترجمة «استعادة حريتنا في التعلم» في «الترجمة بصفتها تعليمًا: أعمال مختبر الترجمة» (سيلاس، 2018).',
    roles: ['member'],
  },
  {
    name: 'Nora Helmy',
    name_ar: 'نورا حلمي',
    email: 'noura.halmy@cilas.test',
    bio: 'A translator of "Healing Ourselves from the Diploma Disease" in "Translation as Education: Works of the Translation Lab" (CILAS, 2018).',
    bio_ar:
      'شاركت في ترجمة «التعافي من داء الدبلومات» في «الترجمة بصفتها تعليمًا: أعمال مختبر الترجمة» (سيلاس، 2018).',
    roles: ['member'],
  },
  {
    name: 'Sara Alaa',
    name_ar: 'سارة علاء',
    email: 'sara.alaa@cilas.test',
    bio: 'A translator of "Healing Ourselves from the Diploma Disease", and author of the closing note (خاتمة), in "Translation as Education: Works of the Translation Lab" (CILAS, 2018).',
    bio_ar:
      'شاركت في ترجمة «التعافي من داء الدبلومات»، وكتبت «خاتمة»، في «الترجمة بصفتها تعليمًا: أعمال مختبر الترجمة» (سيلاس، 2018).',
    roles: ['member'],
  },
  {
    name: 'Amal Abdel Rahman',
    name_ar: 'أمل عبد الرحمن',
    email: 'amal.abdelrahman@cilas.test',
    bio: 'A translator of "Healing Ourselves from the Diploma Disease" in "Translation as Education: Works of the Translation Lab" (CILAS, 2018).',
    bio_ar:
      'شاركت في ترجمة «التعافي من داء الدبلومات» في «الترجمة بصفتها تعليمًا: أعمال مختبر الترجمة» (سيلاس، 2018).',
    roles: ['member'],
  },
  {
    name: 'Heba Allah Mansour',
    name_ar: 'هبة الله منصور',
    email: 'heba.mansour@cilas.test',
    bio: 'A translator of "Healing Ourselves from the Diploma Disease" in "Translation as Education: Works of the Translation Lab" (CILAS, 2018).',
    bio_ar:
      'شاركت في ترجمة «التعافي من داء الدبلومات» في «الترجمة بصفتها تعليمًا: أعمال مختبر الترجمة» (سيلاس، 2018).',
    roles: ['member'],
  },
  {
    name: 'Sara Sallam',
    name_ar: 'سارة سلّام',
    email: 'sara.salam@cilas.test',
    bio: 'A translator of "Healing Ourselves from the Diploma Disease" in "Translation as Education: Works of the Translation Lab" (CILAS, 2018).',
    bio_ar:
      'شاركت في ترجمة «التعافي من داء الدبلومات» في «الترجمة بصفتها تعليمًا: أعمال مختبر الترجمة» (سيلاس، 2018).',
    roles: ['member'],
  },
  {
    name: 'Mohamed Nagy Sanger',
    name_ar: 'محمد ناجي سنجر',
    email: 'mohamed.nagu@cilas.test',
    bio: 'A translator of "Healing Ourselves from the Diploma Disease" in "Translation as Education: Works of the Translation Lab" (CILAS, 2018).',
    bio_ar:
      'شارك في ترجمة «التعافي من داء الدبلومات» في «الترجمة بصفتها تعليمًا: أعمال مختبر الترجمة» (سيلاس، 2018).',
    roles: ['member'],
  },
  {
    name: 'Amir Zaki',
    name_ar: 'أمير زكي',
    email: 'amir.zaki@cilas.test',
    bio: 'Proofreader of "Translation as Education: Works of the Translation Lab" (CILAS, 2018), and a reviewer of "A Brief History of Alternative Education" and "Reading, Writing, and Understanding".',
    bio_ar:
      'المراجعة اللغوية لـ«الترجمة بصفتها تعليمًا: أعمال مختبر الترجمة» (سيلاس، 2018)، وشارك في مراجعة «موجز تاريخ التعليم البديل» و«القراءة والكتابة والفهم».',
    roles: ['member'],
  },
  {
    name: 'Nahir Emad',
    name_ar: 'نهير عماد',
    email: 'nahir.emad@cilas.test',
    bio: 'A reviewer of "Reading, Writing, and Understanding" in "Translation as Education: Works of the Translation Lab" (CILAS, 2018).',
    bio_ar:
      'شاركت في مراجعة «القراءة والكتابة والفهم» في «الترجمة بصفتها تعليمًا: أعمال مختبر الترجمة» (سيلاس، 2018).',
    roles: ['member'],
  },
  {
    name: 'Nazih Awad',
    name_ar: 'نزيه عوض',
    email: 'nazihy.awad@cilas.test',
    bio: 'A translator of "On Reading and Not Reading Theoretical Works" in "Translation as Education: Works of the Translation Lab" (CILAS, 2018).',
    bio_ar:
      'شارك في ترجمة «حول كيفية قراءة الأعمال النظرية» في «الترجمة بصفتها تعليمًا: أعمال مختبر الترجمة» (سيلاس، 2018).',
    roles: ['member'],
  },
  {
    name: 'Amr Okasha',
    name_ar: 'عمرو عكاشة',
    email: 'amr.okasha@cilas.test',
    bio: 'Cover designer of "Translation as Education: Works of the Translation Lab" (CILAS, 2018).',
    bio_ar: 'صمّم غلاف «الترجمة بصفتها تعليمًا: أعمال مختبر الترجمة» (سيلاس، 2018).',
    roles: ['member'],
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
 * Each fixture becomes a person (public profile) and an account linked to it.
 * People are wiped by resetContent and recreated; accounts are matched by email
 * and survive, so a real account's password is never touched.
 *
 * The account's roles are written before courses exist, so the users hook
 * strips `fellow` here; the Courses hook grants it back as seedCourses lists
 * each person.
 */
export const seedUsers = async (payload: Payload, ctx: SeedContext): Promise<void> => {
  for (const seed of usersData) {
    const personId = await getOrCreateId(payload, 'people', { name: { equals: seed.name } }, () =>
      payload.create({
        collection: 'people',
        data: {
          name: seed.name,
          visible: true,
          slug: slugify(seed.name),
          bio: lexical(seed.bio),
          website: seed.website ?? null,
          social_links: seed.social_links ?? [],
        },
        overrideAccess: true,
      }),
    )
    await payload.update({
      collection: 'people',
      id: personId,
      data: { name: seed.name_ar, bio: lexical(seed.bio_ar, 'rtl') },
      locale: 'ar',
      overrideAccess: true,
    })
    ctx.people[seed.email] = personId

    const userId = await getOrCreateUser(payload, seed)
    await payload.update({
      collection: 'users',
      id: userId,
      data: { roles: seed.roles, person: personId },
      overrideAccess: true,
    })
    ctx.users[seed.email] = userId

    console.log('person:', seed.name)
  }
}

/** Fails fast if a course lists someone who was never seeded. */
export const linkFellows = async (_payload: Payload, ctx: SeedContext): Promise<void> => {
  for (const course of coursesData) {
    for (const email of course.fellows) {
      if (ctx.people[email] === undefined) {
        throw new Error(`seed: course fellow "${email}" not seeded before courses`)
      }
    }
  }
}
