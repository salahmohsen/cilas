# Course start dates and lengths from the old site (55 courses)

Date of research: 2026-11-13. Branch `feat/course-calendar-sessions`. Data: [2026-11-course-start-dates.json](2026-11-course-start-dates.json) (one object per course, with exact quotes and file paths).

Sources used, in the project order: Weebly pages (`migration/raw/weebly-zip-2025-04-23/`, same files as the archive folder), `migration/raw/mirror/pages/`, `migration/raw/flows/`. `migration/raw/docs/` holds the newsletter, the pigeon-tower books and the translation-lab works. None of these name any of the 55 courses. The Wayback copy and the web were not used. Every quote in the JSON is checked by script against the source text.

## How to read the dates

- `precision: "day"`: the page names the day. 10 courses.
- `precision: "week"`: the page names a start WEEK ("begin the week of January 15th", "Start week is 13th February", "second week of January") or the cycle start. `start_date` is then the first slot weekday inside that week. This is derived, not quoted. `week_anchor` in the JSON is the date the page gives. 44 courses.
- Rule from the user: a course usually starts when its cycle starts. I applied it as the first slot weekday on or after the cycle start, but only where a page states the term window (medium), or marked low where it rests on the DB cycle date alone.
- Every `start_date` falls on a slot weekday, except course 152 (see below). Nothing was moved to make a weekday fit.

## Counts (overall confidence = lower of start and length; a missing length caps it at medium)

| Confidence      | Courses |
| --------------- | ------- |
| high            | 1 (151) |
| medium          | 33      |
| low             | 20      |
| start not found | 1 (7)   |

Length: found for 49 of the 54 dated courses; not found for 24, 30, 78, 152, 195 (and 7).

## Patterns worth knowing

1. **Term pages 2016 to 2018 and Alex 2019 to 2020 give a window, not course dates.** Example: "Thematic courses begin the week of January 15th and end the week of March 23rd", with "ten weeks". Every course in that term starts in that week. This covers 28 of the 55 courses. Terms are 10 weeks in Cairo, 12 weeks (Alex 2019), 11 or 10 weeks (Alex 2020).
2. **Only three 2016 courses give a day on their own page** (50, 104, 247: "starting January 7th/11th/9th, 2016"). The rest of the old course pages have only the weekday and times.
3. **Pages from 2022 on give a day or a start week per course**, in the block for the course. The flows give the week count (Week 1 to N).
4. **The DB cycle date is wrong for the spring 2022 cycle** (ids 153, 154, 156 to 159). It holds 2022-02-02, the semester start. The page took applications until 11 May 2022. Only 155 (not in this list) has a date (Tue 17 May, in its flow). The six courses are marked low with a guess of the week of Sun 15 May.
5. **Fall 2022 thematic courses (87 to 90)** have no date on the page. Cycle start 24 Sep 2022 is used (low). In fall 2021 the labs began 12 Sep but the thematic courses began 21 to 27 Sep, so this could be late by a week or more.
6. **Alex winter 2020 (9 courses): the English and Arabic term texts disagree.** English: begin week of 30 Jan, 11 weeks. Arabic: begin 7 Feb, 10 weeks. I used the English date and put the Arabic one in `alt_start_date`. Marked low.
7. **Conflicts with the DB session counts:** 151 (flow 12, DB 11), 158 (flow outline 11 weeks, DB 7), 210 (syllabus numbers 1 to 12 then 14, 13 headings, DB 13).
8. **Course 152:** page says "Starts June 5th", slot is Saturday, 5 June 2022 is a Sunday. Kept as written, `weekday_matches_slot: false`. The DB value 2022-06-11 is the first Saturday of that week.

## Proposals

| id  | title                                            | cycle                  | slots               | proposed start                | precision | length        | confidence |
| --- | ------------------------------------------------ | ---------------------- | ------------------- | ----------------------------- | --------- | ------------- | ---------- |
| 4   | المترجم فاعلًا: مقدمة في دراسات الترجمة            | winter-2019-alexandria | thu 10:00 thu 17:00 | 2019-01-31                    | week      | 12 wk         | medium     |
| 5   | The Turn of Time: “Colonising Egypt” and the ... | spring-2018-cairo      | sun 11:00 sun 17:30 | 2018-04-01                    | week      | 10 wk         | medium     |
| 6   | مختبر سيلاس للترجمة: الدورة الرابعة في الإسكن...   | winter-2019-alexandria | fri 10:00 fri 17:00 | 2019-02-01                    | week      | 12 wk         | medium     |
| 7   | Africa since Independence                        | spring-2014-cairo      | tue 16:00           | -                             | -         | not found     | none       |
| 24  | Inhabit: Belonging to Bodies and Lands           | spring-2023-cairo      | sat 17:30           | 2023-02-11                    | week      | not found     | medium     |
| 30  | Anthropology and Storytelling Along the Water... | spring-2024-cairo      | wed 17:00           | 2024-05-01                    | day       | not found     | medium     |
| 36  | مختبر البحث الثاني - التأريخ الشفهي: أحياء ال... | winter-2020-alexandria | fri 13:00           | 2020-01-31                    | week      | 11 wk         | low        |
| 42  | Bicycle Diaries                                  | spring-2016-cairo      | fri 10:00           | 2016-04-01                    | week      | 10 wk         | medium     |
| 43  | Biomimicry: Nature's genius inspiring solutio... | winter-2017-cairo      | tue 10:00           | 2017-01-17                    | week      | 10 wk         | medium     |
| 48  | Classical Chinese Philosophies                   | winter-2018-cairo      | wed 10:00 wed 17:30 | 2018-01-10                    | week      | 10 wk, 9 mtg  | medium     |
| 49  | Egyptian Nationalism from 1919 to the Present    | winter-2017-cairo      | wed 17:30 thu 10:00 | 2017-01-18                    | week      | 10 wk         | medium     |
| 50  | el rihla: literature and re-thinking Egypt's ... | winter-2016-cairo      | thu 10:00 thu 17:30 | 2016-01-07                    | day       | 10 wk         | medium     |
| 51  | elites in history, society, and politics         | spring-2016-cairo      | wed 17:30           | 2016-03-30                    | week      | 10 wk         | medium     |
| 53  | Encountering the State: Anthropological Persp... | winter-2020-alexandria | sun 18:00           | 2020-02-02                    | week      | 11 wk         | low        |
| 54  | Every cook can govern                            | winter-2020-alexandria | thu 18:00           | 2020-01-30                    | week      | 11 wk         | low        |
| 78  | Enlightenment to the Death of God: A Philosop... | fall-2024-cairo        | wed 18:00           | 2024-09-25                    | day       | not found     | medium     |
| 87  | CITY & CINEMA                                    | fall-2022-cairo        | wed 18:00           | 2022-09-28                    | week      | 8 wk          | low        |
| 88  | The Modern and the Mediterranean: The Age of ... | fall-2022-cairo        | mon 10:00           | 2022-09-26                    | week      | 8 wk          | low        |
| 89  | Vocabularies of Grief                            | fall-2022-cairo        | tue 18:00           | 2022-09-27                    | week      | 6 wk          | low        |
| 90  | Women's Writing and the Literary Canon           | fall-2022-cairo        | wed 18:00           | 2022-09-28                    | week      | 8 wk          | low        |
| 92  | FEMINIST PEDAGOGY LAB                            | fall-2022-cairo        | thu 17:30           | 2022-09-29                    | week      | 12 wk         | medium     |
| 99  | مختبر الوسائط - كيف تريد أن تُرى؟: ملاحظات عل...   | winter-2020-alexandria | sat 11:00           | 2020-02-01                    | week      | 11 wk         | low        |
| 102 | “The Weapon of Theory”: Critical Thought and ... | winter-2018-cairo      | sun 10:00 sun 17:30 | 2018-01-07                    | week      | 10 wk         | medium     |
| 103 | Libertarian Economics and Alternative Model-B... | spring-2018-cairo      | thu 10:00 thu 17:30 | 2018-04-05                    | week      | 10 wk         | medium     |
| 104 | literary representations of the urban global ... | winter-2016-cairo      | mon 10:00 mon 17:30 | 2016-01-11                    | day       | 10 wk         | medium     |
| 105 | Mafish Faiydah? A Case Study on Myth and Sile... | spring-2018-cairo      | sun 10:00 sun 17:30 | 2018-04-01                    | week      | 10 wk         | medium     |
| 106 | Matte مصر Tropicália                             | winter-2019-alexandria | thu 10:00 thu 17:00 | 2019-01-31                    | week      | 12 wk         | medium     |
| 111 | My Body is my Body                               | winter-2018-cairo      | mon 17:30           | 2018-01-08                    | week      | 10 wk         | medium     |
| 122 | Pedagogical Lab: An Act of Re-imagination and... | winter-2020-alexandria | mon 18:00           | 2020-02-03                    | week      | 11 wk         | low        |
| 135 | مختبر البحث الأول - مستقبلات ما بعد رأسمالية:...   | winter-2020-alexandria | sat 14:30           | 2020-02-01                    | week      | 11 wk         | low        |
| 137 | Social Determinants of Health                    | spring-2018-cairo      | wed 17:30           | 2018-04-04                    | week      | 10 wk         | medium     |
| 138 | Sound Thinking: A Seminar of Auditory Praxis     | winter-2017-cairo      | sun 17:30           | 2017-01-15                    | week      | 10 wk         | medium     |
| 150 | Reading Feminism/Writing To Live                 | spring-2022-cairo      | mon 18:00           | 2022-02-14                    | week      | 12 mtg        | medium     |
| 151 | The Space Lab: Navigating the Larger African ... | spring-2022-cairo      | thu 18:00           | 2022-02-17                    | day       | 12 wk, 12 mtg | high       |
| 152 | Approaching Performativity and Culture in Mod... | spring-2022-cairo      | sat 18:00           | 2022-06-05 (weekday mismatch) | day       | not found     | low        |
| 153 | Intercessing with artistic research              | spring-2022-cairo      | tue 10:00           | 2022-05-17                    | week      | 7 mtg         | low        |
| 154 | Is she tough enough?                             | spring-2022-cairo      | thu 11:00           | 2022-05-19                    | week      | 8 wk          | low        |
| 156 | The Shadow of Carl Schmitt                       | spring-2022-cairo      | thu 18:00           | 2022-05-19                    | week      | 7 mtg         | low        |
| 157 | The Threshold of Fire: Incendiarism, Hysteria... | spring-2022-cairo      | sun 18:00           | 2022-05-15                    | week      | 6 wk          | low        |
| 158 | The Whatness of Cinematic Urbanism               | spring-2022-cairo      | mon 18:00           | 2022-05-16                    | week      | 11 wk         | low        |
| 159 | Towards a History of Islamicate Print            | spring-2022-cairo      | wed 18:00           | 2022-05-18                    | week      | 8 wk          | low        |
| 195 | اللغة والحِجاج القانوني في مشاهد المحاكمات في...  | spring-2022-cairo      | wed 18:00           | 2022-02-16                    | week      | not found     | medium     |
| 210 | Confronting Modernity: Art, Politics, Religio... | spring-2025-cairo      | sun 18:00           | 2025-01-19                    | day       | 13 mtg        | medium     |
| 216 | History and/in Anthropology?                     | spring-2026-cairo      | tue 18:00           | 2026-04-28                    | day       | 10-12 wk      | medium     |
| 224 | اللعب بالأرشيف: معمل بحثي إبداعي                  | spring-2025-cairo      | mon 18:00           | 2025-01-20                    | day       | 10-12 wk      | medium     |
| 242 | The Death of the Political?                      | summer-2022-cairo      | sun 18:00           | 2022-07-24                    | week      | 6 wk          | medium     |
| 247 | the death of Nature                              | winter-2016-cairo      | sat 10:00           | 2016-01-09                    | day       | 10 wk         | medium     |
| 261 | Visions of the Arab: Between Orientalism & Or... | spring-2017-cairo      | tue 10:00 tue 17:30 | 2017-04-11                    | week      | 10 wk         | medium     |
| 262 | Visual Anthropology: Film as a tool for research | winter-2018-cairo      | thu 10:00 thu 17:30 | 2018-01-11                    | week      | 10 wk         | medium     |
| 263 | Voice of the Artist                              | winter-2018-cairo      | thu 10:00 thu 17:30 | 2018-01-11                    | week      | 10 wk         | medium     |
| 265 | We are what we eat                               | winter-2017-cairo      | mon 10:00 mon 17:30 | 2017-01-16                    | week      | 10 wk         | medium     |
| 274 | The Politics of Language and Alphabets: Histo... | winter-2022-cairo      | sun 18:00           | 2022-01-09                    | week      | 8 wk          | medium     |
| 293 | مختبر الترجمة: أنت وأنا ونظرية الترجمة           | winter-2020-alexandria | fri 17:30           | 2020-01-31                    | week      | 11 wk         | low        |
| 294 | Youth Madness                                    | winter-2020-alexandria | sun 18:00           | 2020-02-02                    | week      | 11 wk         | low        |
| 297 | يوميات دراجة سكندرية                             | winter-2020-alexandria | sat 18:00           | 2020-02-01                    | week      | 11 wk         | low        |

## Not found

| id                          | what is missing       | searched                                                                                                                                                                                                                                                                                     |
| --------------------------- | --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 7 Africa since Independence | start date and length | `2013-2014.html` (weekly timetable only: Tue 4 pm to 7 pm, no dates), the course description in the same page, all flows, docs, mirror. The cycle (spring 2014) has no start date in the DB. The 2014-2015 second trimester page (3 Jan to 15 Mar 2015) is the next year and does not apply. |
| 24, 30, 78, 152, 195        | length only           | Term page, flow text. Pages say "weekly" or "every Wednesday" with no count. 30 and 78 have a day-level start.                                                                                                                                                                               |

Course 7 is the only course without a start. For length, 224 and 216 have a range (10 to 12 weeks) instead of one number.

## Applied

2026-11-13, on the local copy, by `scripts/apply-archive-start-dates.ts` (rule: `scripts/archive-start-dates.ts`, ADR 0011 decision log).

- **Dated: 37 courses.** Every high and medium course, and the 9 Alexandria winter 2020 courses (low) on the English term text: week of 30 January 2020, 11 weeks (`start_date`, not `alt_start_date`). The start and length come from this JSON. A meeting count became weeks (150: 12, 210: 13). Only missing fields were written: course 48 keeps its 9 weeks.
- **Not dated, no single length: 6 courses.** 24, 30, 78, 195 (no length found); 216, 224 (10 to 12 weeks).
- **Not dated, low or none: 12 courses.** 7, 87, 88, 89, 90, 152, 153, 154, 156, 157, 158, 159.
- The 18 undated courses keep their times as words in `timing_note`, only in a language with no note. 8 have an English note, kept as written (88, 152, 153, 154, 156, 157, 158, 159; their Arabic note gets the words). 10 have no note (7, 24, 30, 78, 87, 89, 90, 195, 216, 224).
- The fill then refilled the 37 courses (`--refill`): 144 sessions deleted and made again, no space post named them. Sessions with a meeting: 1,047 before, 1,426 after (of 1,995). The verify script shows no difference.
