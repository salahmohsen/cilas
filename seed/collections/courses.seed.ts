import type { Payload } from 'payload'
import { slugify } from '@/lib/slugify'
import type { CourseSeed, SeedContext } from '../seed.type'
import { getOrCreateId, lexical, reading, requireIds, watch, weekly } from '../seed.utils'

/** Expands `count` weekly sessions for a course whose flow PDF was not published. */
const shortSeries = (
  count: number,
  firstDate: string,
  start: string,
  end: string,
  theme?: string,
): ReturnType<typeof weekly> =>
  weekly(firstDate, start, end, Array.from({ length: count }, (_, i) => ({
    order: i + 1,
    session_title: theme && i === 0 ? theme : `Session ${i + 1}`,
  })))

export const coursesData: CourseSeed[] = [
  /* === bridge programme semester one — core curriculum (enrolled CILASians) === */
  {
    course_type: 'CORE',
    tier: 'community',
    title: 'Historical Consciousness',
    description:
      `A core course of the bridge programme’s first semester: exposing students to histories and philosophies of the arts and sciences, some of the more prominent –isms of the modern age, and the ongoing debates around them.`,
    location: ['OFFLINE'],
    cycle: 'fall-2025',
    fellows: [],
  },
  {
    course_type: 'CORE',
    tier: 'community',
    title: 'Philosophical and Poetic Inquiry',
    description:
      `A core course of the bridge programme’s first semester: trans-disciplinary, discussion-based inquiry into philosophical and poetic traditions, part of the intellectual and socio-emotional foundation for community-building.`,
    location: ['OFFLINE'],
    cycle: 'fall-2025',
    fellows: [],
  },
  {
    course_type: 'CORE',
    tier: 'community',
    title: 'Ethnographic Study',
    description:
      `A core course of the bridge programme’s first semester: attending to everyday life, fieldwork, and writing culture, closing the core curriculum before the self-directed study period.`,
    location: ['OFFLINE'],
    cycle: 'fall-2025',
    fellows: [],
  },

  /* === fall cycle 2025 — short courses (6–8 weeks) === */
  {
    course_type: 'THEMATIC',
    tier: 'public',
    title: 'فلسفة "تربية المقهورين" عند پاولو فريري',
    subtitle: 'Pedagogy of the Oppressed: the philosophy of Paulo Freire',
    title_ar: 'فلسفة "تربية المقهورين" عند پاولو فريري',
    description:
      'تستعرض هذه الدورة فلسفة الفيلسوف والمربي البرازيلي باولو فريري، المعروفة باسم «تربية المقهورين»، ومن خلالها نسعى للإجابة عن أسئلة جوهرية: من هم المقهورون؟ وما معنى تربيتهم؟ وكيف يمكن أن تتحقق هذه التربية في واقعنا المعيش وممارساتنا نحن بمختلف تخصصاتنا واهتماماتنا؟ تركز الدورة على المزج بين البعد التطبيقي والنظري؛ إذ تتضمن ممارسة تمارين عملية وتنفيذ مشاريع عمل تهدف إلى فهم الفلسفة وممارستها في الحياة اليومية، إلى جانب قراءة متعمقة لكتاب «تربية المقهورين» ودراسته في سياق تحليل نماذج من الواقع المصري.',
    location: ['ONLINE'],
    cycle: 'fall-2025',
    fellows: ['shadi.jamal@cilas.test'],
    ...shortSeries(6, '2025-10-23', '18:00', '20:30'),
  },
  {
    course_type: 'WORKSHOP',
    tier: 'public',
    title: 'Melancholia in the City',
    description:
      'Melancholia in the City explores the diffuse sense of malaise pervading contemporary urban life, approaching depression through the lens of psychoanalysis as a social and structural experience shaped by how late capitalism hijacks unconscious desire. In dialogue with its participants, the workshop grounds these questions in the context of Cairo, and considers how melancholia might be understood not only as a symptom of exhaustion and loss, but also as a mode of critique, resistance, and the site of potential transformation.',
    location: ['OFFLINE'],
    cycle: 'fall-2025',
    fellows: ['georgelouisbartlett@gmail.com'],
    ...shortSeries(8, '2025-10-28', '18:00', '20:30'),
  },
  {
    course_type: 'THEMATIC',
    tier: 'public',
    title: 'Intimate Excavations: Emotional Archaeology as Research Method',
    description:
      'An 8-week seminar-practicum introducing Emotional Archaeology as a way of thinking and researching that centres emotional literacy, ethical presence, and Practice-as-Research. Participants learn to approach archives — from community libraries and personal collections to online blogs and cultural maps — as dynamic sites where memory, identity, and meaning accumulate and shift, and to ask not only what archives contain, but how they feel upon encounter and what they ask of us in return.',
    location: ['ONLINE'],
    cycle: 'fall-2025',
    fellows: ['s.farwah.rizvi@gmail.com'],
    ...shortSeries(8, '2025-10-19', '18:00', '20:30'),
  },
  {
    course_type: 'THEMATIC',
    tier: 'public',
    title: 'Unravelling Oedipus: Wanderings of the Myth in Literature and Theory',
    subtitle: 'تفكك أوديب: تجوالات الأسطورة بين الأدب والنظريات',
    title_ar: 'تفكك أوديب: تجوالات الأسطورة بين الأدب والنظريات',
    description:
      'Addressing themes of agency and freedom, self-knowledge and identity, reason and truth, consciousness and the unseen, the myth of Oedipus is among the most reworked and reimagined in world literature. We begin with the tale’s early Greek versions and Sophocles’ two Oedipus plays, alongside theoretical texts by Aristotle, Nietzsche, Lévi-Strauss, René Girard, and Freud; then turn to twentieth-century adaptations — Tawfiq al-Hakim’s Oedipus the King (1949), Ali Salem’s Comedy of Oedipus (1970), and films by Pier Paolo Pasolini and Toshio Matsumoto. Most readings are available in Arabic; discussions may be held in Arabic or English. As a final project, participants choose between a creative project and an essay.',
    location: ['OFFLINE'],
    cycle: 'fall-2025',
    fellows: ['evelyn.richardson@cilas.test'],
    ...shortSeries(8, '2025-10-25', '18:00', '20:30'),
  },
  {
    course_type: 'WORKSHOP',
    tier: 'public',
    title: 'Writing Capitalism',
    title_ar: 'كتابة الرأسمالية',
    description:
      'نحن نعيش في قلب الرأسمالية، شئنا أم أبينا، فهي الهواء الذي نتنفسه والماء الذي نسبح فيه. كيف يمكن الكلام عن "كل شيء" وفي نفس الوقت "لا شيء محدد"؟ ينقسم مساق "كتابة الرأسمالية" إلى شق نظري وشق عملي: يتكون الشق النظري من أربع جلسات تناقش قراءات وأفلاماً تتعلق بالحياة في ظل الرأسمالية المعاصرة، أما الشق العملي فهو كتابة وتطوير ومناقشة مشروع نص إبداعي حر عن الحياة في ظل الرأسمالية المعاصرة، باللغة العربية أو الإنجليزية. يتم اختيار المشاركين عن طريق تقديم نص إبداعي (قصة، قصائد شعر، نص حر) لا يقل عن 500 كلمة.',
    location: ['ONLINE'],
    cycle: 'fall-2025',
    fellows: ['mina.nagy@cilas.test'],
    ...shortSeries(8, '2025-10-20', '18:00', '20:30'),
  },

  /* === winter cycle 2026 — offline, until 31 January deadline === */
  {
    course_type: 'WORKSHOP',
    tier: 'public',
    title: 'Seeing with the Eyes of your Heart: William Blake, Poet & Painter',
    description:
      "A four-week class carefully exploring the poetry and art of Blake's Songs of Innocence and of Experience. Each poem is illuminated, flanked and framed by intriguing imagery and designs. We read Blake's poems aloud, discuss their designs, and do a bit of in-class writing, including at least one poetry game. The course culminates in a celebration in which you are invited to bring Arabic (or Persian) poetry akin to Blake's.",
    location: ['OFFLINE'],
    cycle: 'winter-2026',
    fellows: ['susanne.sklar@gmail.com'],
    ...shortSeries(4, '2026-02-26', '18:00', '20:30'),
  },
  {
    course_type: 'LAB',
    tier: 'public',
    title: 'Writing Lab: Seeing the Mystery of Space; Walking the Music of Time',
    description:
      "Story, narrative, and poetry are all, to paraphrase poet-essayist Robert Bringhurst, 'forms of knowing'. In this four-week course we draw on views of harmony (balancing concord and discord) to inform an approach to creative writing based on an immersion in 'the knowing', inspired by an integrated view of the classical liberal arts. Participants may work in English and/or Arabic; films, webcasts, video journals, artwork, social sculptures, or musical compositions are acceptable, as long as academic rigour and critical and creative thinking are evidenced in both process and outputs.",
    location: ['OFFLINE'],
    cycle: 'winter-2026',
    fellows: ['leon@traditionaltutor.co.uk'],
    ...shortSeries(4, '2026-02-21', '19:00', '21:30'),
  },
  {
    course_type: 'THEMATIC',
    tier: 'public',
    title: 'Who Are "We"? Class, Identity, and the Struggle of Belonging',
    title_ar: 'أنا بنت مين يا داده',
    description:
      'A workshop-style seminar where participants come together to think collectively about social class and identity from an anthropological perspective, connecting key ideas to everyday life and to the social and political challenges of the present. We explore how social class has been understood in the social sciences, examine identity as the broader framework within which class operates, unfold questions of colonialism, power, and representation, and bring ethnographic studies — with particular attention to research from Egypt — into conversation with lived realities.',
    location: ['OFFLINE'],
    cycle: 'winter-2026',
    fellows: ['ghosoun.ismail@cilas.test'],
    ...shortSeries(8, '2026-02-25', '18:00', '20:30'),
  },
  {
    course_type: 'THEMATIC',
    tier: 'public',
    title:
      'Decolonization as Metaphor: Indigeneity, Self-determination & the Limit of Human Rights',
    description:
      "“Decolonization” has become one of the most powerful words in contemporary political and intellectual life. This course asks what happens when decolonization travels as a metaphor, especially within the moral and legal vocabularies of human rights. It focuses on Indigenous peoples in the United States to clarify what “decolonization” names when treated as a struggle over land, jurisdiction, and settler-state legitimacy, and traces how emancipatory claims are translated into “acceptable” forms — cultural rights, recognition regimes, UNDRIP — without resolving the underlying conflict over sovereignty.",
    location: ['OFFLINE'],
    cycle: 'winter-2026',
    fellows: ['zeina.ali@cilas.test'],
    ...shortSeries(8, '2026-02-25', '18:00', '20:30'),
  },
  {
    course_type: 'THEMATIC',
    tier: 'public',
    title: 'Beyond the Binary: Bridging the Gap Between Nature and Culture',
    description:
      '“The relationship between Nature and Culture is the key intellectual problem of the 21st century” — Jonathan Bates. No period has ever alienated humankind from the natural world as much as the modern era. Students learn to trace the origins of the nature–culture binary and its impacts on contemporary human–environmental relations, using environmental anthropology to critique and explore proposals to ultimately bridge the gap between us and our perennial home.',
    location: ['OFFLINE'],
    cycle: 'winter-2026',
    fellows: ['ahmad.mahana@cilas.test'],
    ...shortSeries(8, '2026-02-24', '18:00', '20:30'),
  },

  /* === spring cycle 2026 — semester two === */
  {
    course_type: 'THEMATIC',
    tier: 'public',
    title: 'Heroism and Modernity',
    title_ar: 'البطولة والحداثة',
    description:
      'Heroism and Modernity explores the anthropological, philosophical and theological changes experienced by modern man at the decisive moment of transition from the mythical age to the modern age. Through conversations and discussions, the course explores an array of readings ranging from philosophical analysis to commentary on literature and films that break down and illustrate the progression of the hero figure throughout history.',
    location: ['OFFLINE'],
    cycle: 'spring-2026',
    fellows: ['karim.eldalil@cilas.test'],
    ...weekly('2026-04-26', '18:00', '20:30', [
      {
        order: 1,
        session_title: 'The End of History',
        description: 'Introduction to the end of history concept and its effect on storytelling.',
        bibliography: [
          reading('The End of History', 'Francis Fukuyama'),
          reading('The End of History Illusion', 'Daniel Gilbert'),
          reading('Between Past and Future — Tradition and Modern Age', 'Hannah Arendt'),
        ],
      },
      {
        order: 2,
        session_title: 'Hegelian Heroes',
        description: 'Hegel’s definition of the dramatic and of heroism.',
        bibliography: [
          reading('Hegel’s Theory of Tragic Heroes', 'The Historical Progress of Subjectivity'),
          reading('Between Past and Future — The Concept of History', 'Hannah Arendt'),
        ],
      },
      {
        order: 3,
        session_title: 'The Consumption of Heroes',
        description: 'The transition from mythical to modern heroes.',
        bibliography: [
          reading('Philosophy by Other Means', 'Robert Pippin'),
          reading('The Gay Science (books 3, 5)', 'Friedrich Nietzsche'),
        ],
      },
      {
        order: 4,
        session_title: 'The Western Hero',
        description: 'The western genre as a new mythmaking device.',
        bibliography: [
          reading('Hollywood Westerns and the American Myth', 'Robert Pippin'),
          watch('The Man Who Shot Liberty Valance', 'John Ford'),
        ],
      },
      {
        order: 5,
        session_title: 'The Noir Hero',
        description: 'The noir hero as a development of heroes in the modern age.',
        bibliography: [
          reading('Tarrying with the Negative', 'Slavoj Žižek'),
          reading('Between Past and Future — The Gap Between Past and Future', 'Hannah Arendt'),
        ],
      },
      {
        order: 6,
        session_title: 'End of History Storytelling',
        description: 'Fight Club and The Matrix as end-of-history storytelling.',
        bibliography: [
          reading('The Matrix and Philosophy', 'Sarah E. Worth'),
          reading('Between Past and Future — The Crisis in Culture', 'Hannah Arendt'),
        ],
      },
    ]),
  },
  {
    course_type: 'THEMATIC',
    tier: 'public',
    title: 'Buddhist Psychology',
    description:
      'This course covers the psychological aspects of the Buddhist doctrine, exploring the origins and developments of the autochthonous Indian experience of mind-examination — from dukkha to meditation, tranquillity, mindfulness and renunciation — read against modern Western psychology, and demonstrating the principle of Buddhist pyrrhonism in which conventional and ultimate truths are sharply distinguished.',
    location: ['OFFLINE'],
    cycle: 'spring-2026',
    fellows: ['mahaviveka@cilas.test'],
    ...shortSeries(8, '2026-04-28', '18:00', '20:30'),
  },
  {
    course_type: 'THEMATIC',
    tier: 'public',
    title: 'Place in Modern Arabic Literature',
    title_ar: 'المكان في الأدب الحديث',
    description:
      'حلقة دراسية من ثماني جلسات تستكشف علاقة الجغرافيا بالأدب، ودور المكان المتعاظم في الأدب الحديث، بلغة مدارس الأدب الحديث التي تجاوزت النظرة الاستعملية للجغرافيا. فالمكان وعاء الخبرة الإنسانية، ولفتتان الكاتب به لا يعني جماله بذاته، بل قوة المكان وعلاقته المركّبة هي ما يدفع لمعالجته بالكتابة، مع قراءات تطبيقية لأعمال أدبية من زاوية النظر تلك.',
    location: ['OFFLINE'],
    cycle: 'spring-2026',
    fellows: ['yasser@cilas.test'],
    ...shortSeries(8, '2026-04-25', '18:00', '20:30'),
  },
  {
    course_type: 'THEMATIC',
    tier: 'public',
    title: 'Modernity and the Ecological Crisis',
    subtitle: 'Why We Can’t Help but Destroy the World',
    title_ar: 'الحداثة والأزمة البيئية: لماذا لا نستطيع إلا أن ندمّر العالم',
    description:
      'Why We Can’t Help but Destroy the World. This course identifies the material, social, and philosophical processes that define Modernity and how they contribute to the ecological crisis, calling into question Modernity’s conception of nature as an objective domain to be exploited, and exploring methods proposed by scholars to realize the possibility of a different world(s).',
    location: ['OFFLINE'],
    cycle: 'spring-2026',
    fellows: ['ahmad.mahana@cilas.test'],
    ...weekly('2026-04-30', '18:00', '20:30', [
      {
        order: 1,
        session_title: 'Nature, Society, and the Anthropocene: An Introduction',
        bibliography: [
          reading('Anthropocene', 'Chua, Liana & Hannah Fair (2019/2023)'),
          reading('Nature and Society: Anthropological Perspectives', 'Descola & Pálsson (1996)'),
        ],
      },
      {
        order: 2,
        session_title: 'Splitting Nature and Culture: Modern Phenomenon or Ancient Ordeal?',
        bibliography: [
          reading('We Have Never Been Modern', 'Latour (1993)'),
          reading('Meditations on First Philosophy', 'Descartes (1641)'),
          reading('The Ax of Gilgamesh: Splitting Nature and Culture', 'Elmusa (2003)'),
        ],
      },
      {
        order: 3,
        session_title: 'Political Ecology and Climate Crisis',
        bibliography: [
          reading('The political ontology of climate change', 'Burman (2017)'),
          reading('Uncommoning nature: Stories from the Anthropo-Not-Seen', 'de la Cadena (2015)'),
        ],
      },
      {
        order: 4,
        session_title: 'Techno-politics and Associative Sociology',
        bibliography: [
          reading('Can the Mosquito Speak?', 'Mitchell (2002)'),
          reading('Reassembling the Social: an Introduction to Actor-Network-Theory', 'Latour (2005)'),
        ],
      },
      {
        order: 5,
        session_title: 'More-Than-Human Anthropology: Multispecies Ethnography',
        bibliography: [
          reading('Unruly Edges: Mushrooms as Companion Species', 'Tsing (2012)'),
          reading('Staying With the Trouble: Making Kin in the Chthulucene', 'Haraway (2016)'),
        ],
      },
      {
        order: 6,
        session_title: 'Anthropology, Ontology, and Radical Alterity',
        bibliography: [
          reading('Cosmological Deixis and Amerindian Perspectivism', 'Viveiros de Castro (1998)'),
          reading('The Ontological Turn', 'Holbraad & Pedersen (2017)'),
        ],
      },
      {
        order: 7,
        session_title:
          'Animating the inanimate: Pushing the Epistemological Limits of Modernity',
        bibliography: [
          reading('Rethinking the animate, re-animating thought', 'Ingold (2006)'),
          reading('Shakhṣīyat Miṣr [The Personality of Egypt]', 'Hemdan (1980)'),
        ],
      },
      {
        order: 8,
        session_title: 'Semiotics and Cybernetics: Is Meaning Embedded in the Universe?',
        bibliography: [
          reading('Steps to an Ecology of Mind', 'Bateson (1972)'),
          reading('How Forests Think', 'Kohn (2013)'),
        ],
      },
    ]),
  },

  /* === summer cycle 2026 — labs and workshops === */
  {
    course_type: 'LAB',
    tier: 'public',
    title: 'Writing the Self',
    title_ar: 'نكتب أنفسنا',
    description:
      'نكتب يومياتنا ونقفل عليها في درج بعيد عن أعين من نعرف، ونكتب جوابًا لحبيب على ملف Word ثم نغلق الملف بدون حفظ. ماذا يقول كل هذا عن ذواتنا؟ ولماذا نخاف مما نكتب عن أنفسنا؟ يهدف هذا المعمل إلى طرح المزيد من التساؤلات عن كتابة الذات، ونوعها، وما تثيره بداخلنا؛ وكيف تكون هذه الكتابات امتدادًا لذواتنا: تعبيرًا عن هويتنا وجندرنا. كما يهدف إلى التجريب في تلك الأنواع من الكتابة — ملحوظاتنا المنسية، أو اعترافاتنا الغريبة، أو جواباتنا غير مرسلة، أو تفاصيلنا اليومية التي لم نظن أن أحدًا سيهتم بها — وإلى تذوق ألوان أدبية ذاتية، والاشتباك مع نصوص نقدية نسوية حول الكتابة الذاتية. We write our diaries and lock them in a drawer away from the eyes of those we know. What does all this say about ourselves? And why are we afraid of what we write about ourselves?',
    location: ['ONLINE'],
    cycle: 'summer-2026',
    fellows: ['osamaamer@aucegypt.edu'],
    ...shortSeries(10, '2026-07-19', '19:00', '21:30'),
  },
]

export const seedCourses = async (payload: Payload, ctx: SeedContext): Promise<void> => {
  for (const course of coursesData) {
    const { title_ar, description, sessions, schedule, session_unit, fellows, cycle, ...rest } = course

    const id = await getOrCreateId(payload, 'courses', { title: { equals: course.title } }, () =>
      payload.create({
        collection: 'courses',
        data: {
          ...rest,
          title: course.title,
          slug: slugify(course.title),
          description: description ? lexical(description) : null,
          fellows: requireIds(ctx.people, fellows),
          cycle: requireIds(ctx.cycles, [cycle])[0],
          schedule,
          session_unit: session_unit ?? 'session',
          sessions: (sessions ?? []).map(({ description, bibliography, ...s }) => ({
            ...s,
            description: description ? lexical(description) : null,
            bibliography: bibliography ?? [],
          })),
        },
        overrideAccess: true,
      }),
    )

    if (title_ar) {
      await payload.update({
        collection: 'courses',
        id,
        data: { title: title_ar },
        locale: 'ar',
        overrideAccess: true,
      })
    }

    ctx.courses[course.title] = id
    console.log('course:', course.title)
  }
}
