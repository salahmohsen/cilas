# Education discussion and social-learning platforms: features and design patterns

Scope note: These notes cover about 20 searches and fetches. Most findings come from university help pages, which are fairly reliable for features, and from vendor pages, which are less reliable for outcome numbers. Every vendor number is labelled as a vendor claim. Pricing and Arabic/RTL support are thinly sourced. See the Gaps sections.

## 1. Core features per product (Q&A, endorsement, anonymity, categories, pins, polls, reactions, duplicates, AI moderation, points, grading, digests, annotation, argument maps)

### Takeaway
The products fall into a few families. Each family is built around one pedagogical move:
- **Q&A boards** (Ed Discussion, Piazza, Campuswire): questions, instructor-endorsed answers, resolved/unresolved states, and peer-only anonymity.
- **Community feeds with points** (Yellowdig): participation earns points.
- **AI-scored inquiry** (Packback): an AI score for curiosity, plus private coaching.
- **Social annotation** (Perusall, Hypothesis): the discussion sits in the margins of a reading.
- **Structured argument** (Kialo Edu): a tree of pro and con claims under a thesis.
- **Discussion of submitted work** (FeedbackFruits).
- **LMS forums** (Canvas, Moodle, Google Classroom, Teams): general forums, with pedagogy switches such as "post before you see others" and "one thread per person".

### Cited Findings

**Ed Discussion (Q&A board)**
- Instructors and staff can "endorse" a strong response, which shows a blue ribbon. They can also "accept" a comment, which marks a question as resolved. — [Canvas @ Yale: Ed threads](https://help.canvas.yale.edu/a/1452322-ed-discussion-creating-and-managing-threads)
- Anonymous posting can be set to "anonymous to everyone" or "anonymous to classmates only". Instructors can still see who posted. — [TeachWell Auckland](https://teachwell.auckland.ac.nz/?p=59304); [Cornell comparison: Ed vs Canvas Discussions](https://learn.canvas.cornell.edu/comparison-of-discussion-boards-ed-discussion-and-canvas-discussions)
- Threads can go into categories and subcategories, and search can be limited to one category. Filters include unresolved, unanswered and endorsed. — [NYU Steinhardt: Ed Discussion](https://technology.steinhardt.nyu.edu/hc/en-us/articles/16637243925403-Discussion-Q-A-Ed-Discussion); [Berkeley RTL intro to Ed](https://rtl.berkeley.edu/node/634)
- Staff can manually merge a duplicate thread into another thread. I found no source that describes automatic duplicate detection in Ed. — [Canvas @ Yale](https://help.canvas.yale.edu/a/1452322-ed-discussion-creating-and-managing-threads)

**Piazza (Q&A board)**
- Piazza changed to a paid model in 2020–21. Enterprise site licences started in January 2021. Premium polls, statistics and class locking were limited to paid access from August 2021. Free use continued with prompts that ask for an optional contribution. — [Piazza support: Paid model](https://support.piazza.com/support/solutions/articles/48001161300-paid-model-for-piazza-q-a)
- Reported response times:
  - About 14 minutes average, from company data, with no date. — [Wikipedia: Piazza](https://en.wikipedia.org/wiki/Piazza_(web_service))
  - A median of 25 minutes, with 96% of questions answered, in early company data. — [TechCrunch funding article](https://techcrunch.com/?p=478532)
  - About 25 minutes in a typical large course. — [UBC CWSEI 2014](https://cwsei.ubc.ca/files/outcomes/EOY/Maciejewski_Math-Piazza_CWSEI-EOY2014.pdf)
  - 15 minutes in one course of 363 students, because staff checked it often. — [Michigan Daily](https://digital.bentley.umich.edu/midaily/mdp.39015071755271/145)
- A secondary source says the interface was redesigned in fall 2025 and that Piazza added recruiting tools. It says employers cannot see classroom Q&A. — [Grokipedia](https://grokipedia.com/page/Piazza_(web_service)) (low reliability); [yespress.io profile](https://yespress.io/piazza)

**Campuswire (Q&A board plus chat)**
- The search found no report that Campuswire shut down or was acquired. PitchBook lists a later-stage VC round dated 1 March 2026. The company's site calls Campuswire a "Campus Group company". — [PitchBook](https://pitchbook.com/profiles/company/177180-40); [campusgroup.co](https://campusgroup.co/)
- Campuswire's 2020 positioning combined a class feed (Q&A) with real-time chat. — [TechCrunch 2020](https://techcrunch.com/2020/11/11/as-edtech-crowds-up-campuswire-bets-big-on-real-time-learning/)

**Yellowdig (community feed with points)**
- Points come from posting, commenting, receiving comments and receiving reactions. Each course sets its own values. Two example configurations:
  - NIU: 150 points for an original post of at least 40 words, 80 for a comment of at least 20 words, 55 for receiving a comment, 30 for receiving a reaction. — [NIU Yellowdig page](https://blackboard.niu.edu/blackboard/communicate/yellowdig.shtml)
  - A course with a weekly target of 1000 points and a weekly cap of 1,350. — [Course notes, Yellowdig appendix](https://rressler.quarto.pub/data-793-notes/zapp_yellowdig.html)
- At UVM, students who reach the weekly target get no extra credit for more points. "Wiggle room" lets a student make up a short week in later weeks. — [UVM KB](https://www.uvm.edu/it/kb/article/yellowdig/)
- "Accolades" are badges that only instructors can give, and each one awards points. The defaults are "Helpful!", "Interesting!" and "Insightful!". Instructors can edit them. — [UVM KB](https://www.uvm.edu/it/kb/article/yellowdig/); [Rochester config PDF](https://tech.rochester.edu/wp-content/uploads/YellowdigEngage-Configuration.pdf)

**Packback (AI-scored inquiry)**
- Each post gets an AI "Curiosity Score", and students get private coaching. A UNT study looked at about 14,500 posts from more than 800 students and compared AI scores with expert assessments. It found that each extra two words matched about +1 point of score. Posts after coaching scored higher. — [Packback/UNT research](https://packback.co/pedagogy/unt-research-impact-of-packback-asynchronous-discussion)
- Vendor outcome claims are listed in section 4.

**Perusall (social annotation)**
- Students annotate a shared reading. An engagement score combines up to six components, one of which is a reading component, and each component has a target from 0 to 100%. — [Perusall analytics help](https://support.perusall.com/hc/en-us/articles/360033996134-What-kinds-of-analytics-are-available-to-help-understand-student-engagement-and-understanding); [UHD Perusall scoring](https://www.uhd.edu/computing/training-lms/persuall-scoring-and-grading.aspx)

**Hypothesis (social annotation, open source)**
- Students annotate and reply in the margins of any web page or PDF. The LMS app gives single sign-on and an automatic private group for each class. — [Hypothesis education](https://connect.hypothes.is/education/)
- Since 2021 it can mirror Canvas Groups, so reading groups can annotate privately. — [Hypothesis blog](https://web.hypothes.is/blog/hypothesis-social-annotation-now-with-canvas-groups/)
- Annotations sync to the LMS gradebook, including Canvas SpeedGrader. — [Hypothesis education](https://connect.hypothes.is/education/)
- It is built on an open-source platform. — [KPU Hypothesis guide](https://wordpress.kpu.ca/hypothesis/)

**Kialo Edu (argument mapping)**
- A discussion starts from a thesis. Pro and con claims sit under the thesis, and each claim can have its own pros and cons. The map shows as a tree or a "sunburst". — [Blackboard app catalog: Kialo](https://appcatalog.blackboard.com/details/kialo-discussion); [APSA guide PDF](https://educate.apsanet.org/wp-content/uploads/Creating-Online-Debates-Using-Kialo-Edu.pdf)
- Other features:
  - Students can be anonymous, and the instructor can unmask them.
  - Teachers can lock, reorganise or highlight claims.
  - It has a grading tool and task tracking.
  - Each claim is limited to 500 characters.
  - It is free for educators.
  - Sources: [Classroomscreen](https://classroomscreen.com/blog/inclusive-discussion-tools); [Rutgers Canvas](https://canvas.rutgers.edu/external-apps/kialo-edu/); [AVID](https://www.avid.org/digital-tools/Kialo-Edu)

**Padlet (visual wall)**
- Moderation has three modes: None, Auto and Manual.
  - Auto: "Safety Net" AI holds back posts that it flags, and the owner gets an email to approve or reject them.
  - Manual: every post waits for approval.
  - There is also a blocked-words list.
  - Sources: [Padlet content moderation](https://padlet.help/article/v6iz7bhhl1-turn-on-content-moderation); [Block words](https://padlet.help/l/en/article/p7ur6emdzw-how-to-block-inappropriate-words)

**FeedbackFruits "Discussion on Work"**
- Students upload work (documents, audio/video, images, links), and peers discuss it, anonymously or openly. An optional open phase shows all submissions. Discussion can happen individually, in groups, or across groups.
- The tool makes sure feedback is spread across the class and does not collect on a few submissions.
- It has participation tracking, custom prompts and optional reflection steps.
- Sources: [Carleton 2025](https://carleton.ca/brightspace/2025/feedbackfruits-feature-discussion-on-work-and-topic-and-self-assessment-of-work/); [Yale Poorvu](https://poorvucenter.yale.edu/teaching/canvas-yale/instructional-tools/feedbackfruits-discussion-on-work); [Arizona](https://help.intech.arizona.edu/article/860-feedbackfruits-discussions)
- Yale ended its FeedbackFruits access at the end of Fall 2025. — [Yale Poorvu](https://poorvucenter.yale.edu/teaching/canvas-yale/instructional-tools/feedbackfruits-discussion-on-work)

**Minerva Forum (live seminar platform)**
- It records talk time for each student in the main room and in breakouts.
- After each session it reports the student/instructor talk-time ratio, emoji reactions, hand-raises, chats, and each student's talk-time history.
- Professors can use talk-time data to build breakout groups: talkative and quiet students mixed, quiet students together, or random groups.
- It has real-time polls, and breakouts have a shared whiteboard and shared files.
- Sources: [Minerva blog on engagement data](https://www.minerva.edu/blog/a-teachers-guide-how-to-use-data-to-measure-student-engagement); [EdSurge 2019](https://edsurge.com/news/2019-04-16-live-online-video-classes-are-the-new-face-to-face-so-how-many-students-can-they-handle-at-a-time); [Getting Smart 2019](https://www.gettingsmart.com/2019/04/minervas-innovative-platform-makes-high-quality-higher-ed-personal-and-affordable/)
- Availability: it is licensed only to partner institutions behind SSO, with no public API (secondary source). — [apis.io profile](https://apis.io/providers/minerva-project/)
- Note: "Minerva" at Leeds and McGill is a different product, an Anthology LMS. Do not confuse the two.

**Canvas Discussions (redesign, 2024 and later)**
- "Checkpoints" split a graded discussion into an initial reply and required follow-up replies. Each part has its own due date and points. Checkpoints cannot be combined with anonymity. — [PSU OAI+](https://oaiplus.pdx.edu/?p=95444); [MSU Denver](https://ready.msudenver.edu/self-help-tutorials/discussions/create-a-discussion-in-canvas)
- There are two levels of anonymity. With partial anonymity, each student chooses whether to show their name. With full anonymity, names are hidden even from the instructor. Anonymity is limited to ungraded discussions. — [UChicago](https://courses.uchicago.edu/2022/11/07/support-your-pedagogy-with-anonymous-canvas-discussions); [UW-Green Bay](https://blog.uwgb.edu/catl/?p=6344)
- Other features: @mentions, quoting, threaded replies, reporting a reply, and edit history. — [Nova](https://lecnews.nova.edu/?p=46421); [UChicago 2024](https://academictech.uchicago.edu/2024/06/04/use-the-redesigned-canvas-discussions-and-announcements)

**Moodle forums**
- Forum types:
  - "Each person posts one discussion": each student starts exactly one thread and can reply to many.
  - "Q and A forum": a student must post before seeing peers' posts. The delay is about 15 minutes, which is the edit window.
  - Sources: [Swarthmore KB](https://kb.swarthmore.edu:8443/display/MOODLE/Moodle+Forums); [Clackamas](https://kb.dl.clackamas.edu/article/introduction-to-activities-and-resources/create-a-forum-activity/); [MLC forum types](https://help.mlc-wels.edu/books/moodle-for-faculty/page/forum-types)

**Google Classroom stream**
- There are three stream permission levels: students post and comment (the default), students only comment, and only teachers post. They can be set per class or per student. Private comments on assignments still work when the stream is locked. — [Google Classroom help](https://support.google.com/edu/classroom/answer/6099424)

**Microsoft Teams for Education**
- Every class team has a General channel. Teachers add Standard channels, which are open to all, or Private channels, which are open to chosen students.
- There are "Announcement" posts with a coloured banner.
- Insights shows posts, replies and reactions per student, and responses to "Reflect" check-ins.
- Sources: [MS: Get organised in class team](https://support.microsoft.com/en-US/education/teams/get-organized-in-your-class-team); [MS: Insights class overview](https://support.microsoft.com/en-us/education/insights/class-overview-page-in-insights)

### Inferences
- Patterns that recur and that CILAS can build cheaply:
  1. Endorse an answer, and track resolved or unresolved state (Ed, Piazza).
  2. Anonymity to peers only, never to staff (Ed). This is the safest default for a small cohort.
  3. Fixed categories per group (Ed).
  4. Announcement or pinned posts (Teams, Classroom).
  5. Three-level posting permission per group (Classroom).
  6. "Post before you see others" for a prompt (Moodle Q&A). This lowers anchoring on the first reply, which matters in a seminar culture.
  7. Instructor badges such as "Insightful" (Yellowdig accolades). These are a light, non-gamified version of endorsement.
  8. A participation view for fellows: posts, replies and reactions per student (Teams Insights, Minerva talk time).
- Kialo's pro/con tree and Perusall/Hypothesis margin annotation fit a liberal-arts institute that teaches through reading and argument, more than a Q&A board does. Annotation on readings or articles could link to the CMS articles CILAS already has.
- Duplicate detection exists only as a manual "merge" in the sources I found. Automatic duplicate detection is probably low value at CILAS cohort sizes.

### Gaps
- I found no source that confirms automatic duplicate detection ("similar posts") in Ed or Piazza. Piazza is widely said to suggest similar posts as a user types a question, but I did not verify this.
- Daily or weekly digest emails: I found no sources for Ed, Piazza or Moodle digests in this pass. Moodle has digest subscriptions, but I did not verify this here.
- Packback's points and leaderboard mechanics in detail, Perusall's exact scoring components, and Hypothesis tags: not retrieved.
- I did not research open-source community engines such as Discourse or Moodle as a standalone product.

## 2. How the tools tie discussion to course structure

### Takeaway
The strongest pattern is to attach the discussion to the course object itself:
- the reading (Perusall, Hypothesis)
- the submission (FeedbackFruits)
- the thesis (Kialo)
- the graded assignment with checkpoints (Canvas)
- the category or week (Ed)

General feeds such as Yellowdig, Teams and Classroom depend on weekly point targets or announcements to set a rhythm.

### Cited Findings
- Ed: categories and subcategories, which are often per week, lecture or assignment, with category-scoped search. — [NYU](https://technology.steinhardt.nyu.edu/hc/en-us/articles/16637243925403-Discussion-Q-A-Ed-Discussion)
- Perusall and Hypothesis: the discussion happens in the margins of the assigned reading. Hypothesis creates a private group per class and per LMS group, and annotations go to the gradebook. — [Hypothesis](https://connect.hypothes.is/education/); [Hypothesis Canvas Groups](https://web.hypothes.is/blog/hypothesis-social-annotation-now-with-canvas-groups/)
- Canvas checkpoints link discussion to due dates: one initial reply plus N replies, each with its own due date. — [PSU](https://oaiplus.pdx.edu/?p=95444)
- Yellowdig sets a rhythm with weekly point targets and caps. — [UVM](https://www.uvm.edu/it/kb/article/yellowdig/)
- FeedbackFruits starts the discussion from each student's submission and spreads peers across submissions. — [Yale](https://poorvucenter.yale.edu/teaching/canvas-yale/instructional-tools/feedbackfruits-discussion-on-work)
- Teams uses channels inside the class team, often one per topic or unit, with private channels for subgroups. — [MS](https://support.microsoft.com/en-US/education/teams/get-organized-in-your-class-team)

### Inferences
- CILAS already has course sessions and schedules. A thread type "session discussion" could be created automatically for each session, with its pre-reading attached. This copies the Ed category-per-lecture pattern and the Perusall reading-anchored pattern without new infrastructure.
- A "prompt" post type from a fellow could have an optional "reply before you see others" setting and an optional deadline. This combines the Moodle Q&A forum and Canvas checkpoints.

### Gaps
- I found no published data that compares per-session threads with an open feed.

## 3. Moderation and role models

### Takeaway
Most tools use instructor plus staff (TA) roles. Staff can endorse, pin, merge, unmask anonymous posters, and approve held posts. Students moderate mainly through reactions and reports. Automated moderation is either a pre-publication hold (Padlet Auto) or AI coaching and scoring (Packback).

### Cited Findings
- Ed: instructors and staff endorse and accept answers, and they can see anonymous posters. — [Yale](https://help.canvas.yale.edu/a/1452322-ed-discussion-creating-and-managing-threads); [Cornell](https://learn.canvas.cornell.edu/comparison-of-discussion-boards-ed-discussion-and-canvas-discussions)
- Padlet: None, Auto (AI holds flagged posts, owner approves) or Manual (all posts are held). Admins also approve. — [Padlet](https://padlet.help/article/v6iz7bhhl1-turn-on-content-moderation)
- Canvas: students can report a reply, and edit history is visible. — [UChicago 2024](https://academictech.uchicago.edu/2024/06/04/use-the-redesigned-canvas-discussions-and-announcements)
- Kialo: teachers lock, reorganise and highlight claims, and can unmask anonymous students. — [Classroomscreen](https://classroomscreen.com/blog/inclusive-discussion-tools)
- Google Classroom: posting permissions can be set per student, so one disruptive student can be muted. — [Google](https://support.google.com/edu/classroom/answer/6099424)
- Packback: 55% of faculty agree that they spend less time moderating (vendor claim). — [Packback outcomes](https://packback.co/product/student-outcomes)

### Inferences
- For CILAS, a suggested role model:
  - Fellows act as moderators in their course group. They can pin, endorse, hide, mute a member, and see anonymous authors.
  - Staff or admins moderate the programme groups and the community group.
  - Optionally, one "student steward" role per cohort can pin and tag posts but cannot see anonymous authors.
  - Members have report and react.
- A held-post queue ("first post needs approval", or Padlet-style manual mode) could reuse CILAS's existing editorial review flow.

### Gaps
- I found no source that documents a formal student-moderator role in Ed or Piazza. Piazza allows students to be made TAs informally, but I did not verify this.

## 4. Features reported to drive participation (with numbers)

### Takeaway
The figures are mostly vendor-reported and are not causal. The most consistent signals are fast staff response (Piazza, 14–25 minutes) and graded or scored pre-class work (Perusall, 90–95% reading completion in one small study). Weekly targets for points or posts (Yellowdig, Packback) report gains in posting volume and retention. All numbers below are vendor claims unless marked otherwise.

### Cited Findings
- **Perusall:** in the Miller et al. 2018 Harvard physics study, 90–95% of students completed all but a few readings before class, against a baseline of 20–40%. The sample was small (74 and 79 students), and the authors did not claim causality. — [UConn Perusall overview](https://chandler.webdev.its.uconn.edu/an-overview-of-perusall); [WashU CTL](https://ctl.wustl.edu/?p=7854)
- **Perusall, independent counter-evidence:** in an intro programming course, 78% of students attempted interactions on average, but completion fell from 44% to 21% after one unit and stayed under 20% later. — [arXiv 2407.10322](https://arxiv.org/pdf/2407.10322)
- **Packback** (all vendor claims):
  - nearly 2x more posts per student than LMS boards with the same requirements
  - 1.83x more weekly active users
  - 50% more posts over 120 words
  - more than twice as many posts with citations
  - 11% more A's on writing assignments, 46% fewer D's
  - 83% of students rate it more effective than LMS boards
  - 93% of professors continue after a pilot
  - No sample sizes or study designs are given.
  - Source: [Packback student outcomes](https://packback.co/product/student-outcomes)
- **Packback survey:** 58% of more than 5,000 students said they were more curious about the course subject, and 72% felt more confident forming open-ended questions. The survey is self-reported and run by the vendor. — [Packback case studies](https://packback.co/case-studies)
- **Yellowdig** (vendor claims): 5–10% better retention across more than 50 communities, 9% or more higher completion and pass rates, and 94.5% of faculty saying it engages students better than other tools. — [Yellowdig gamification page](https://yellowdig.co/gamification-drives-satisfaction)
- **Yellowdig with OES** (press release): a university partner saw 9% higher pass rates and 7% more students moving to the next study period among high-risk students. This used an early-warning tool fed by Yellowdig participation data. — [Higher Ed Dive press release](https://www.highereddive.com/press-release/20211021-oes-study-reveals-yellowdigs-importance-in-identifying-at-risk-students)
- **Piazza response times:** about 14 minutes average (company), a 25-minute median with 96% of questions answered (early company data), and 15 minutes in one 363-student course where staff checked often. — [Wikipedia](https://en.wikipedia.org/wiki/Piazza_(web_service)); [TechCrunch](https://techcrunch.com/?p=478532); [Michigan Daily](https://digital.bentley.umich.edu/midaily/mdp.39015071755271/145)
- **Minerva Forum:** talk-time data is used to balance participation in the next class and in breakouts. No numbers were found. — [Minerva blog](https://www.minerva.edu/blog/a-teachers-guide-how-to-use-data-to-measure-student-engagement)

### Inferences
- The drivers that transfer to CILAS without full gamification:
  - visible fellow presence, meaning fast replies and endorsements
  - a weekly rhythm, such as a weekly prompt per session
  - recognition, such as fellow badges or "good question"
  - feedback to fellows about who is silent, like Minerva talk time or a participation summary
- Point leaderboards are the least proven independently and may not suit a liberal-arts culture.
- The Packback finding that the score tracks word count is a warning that automated quality scores can reward length.

### Gaps
- I found no independent peer-reviewed numbers for Yellowdig's points or Packback's Curiosity Score as such. (The Liberty University dissertation on Packback exists, but only its abstract was visible.)
- I found no figures for the effect of anonymity, polls or reactions on participation in these tools.

## 5. Arabic / RTL and multilingual support

### Takeaway
I found almost no evidence of Arabic or RTL support in Ed, Piazza, Perusall, Kialo or Yellowdig. Padlet is the only tool with documented Arabic: its help centre has Arabic pages, and its AI moderation covers Arabic. Major LMSs (Moodle, Canvas, Teams, Classroom) are generally localised, but I did not verify this in this pass. This is a strong argument for building in-house, because CILAS already handles bilingual and RTL.

### Cited Findings
- Padlet's Auto moderation lists Arabic among the supported languages. — [Padlet content moderation](https://padlet.help/l/en/article/v6iz7bhhl1-untitled-article-klr)
- Padlet's help centre has Arabic-language pages, for example the blocked-words article. — [Padlet help (ar)](https://padlet.help/l/ar/article/p7ur6emdzw-how-to-block-inappropriate-words)

### Inferences
- Bidirectional text inside one thread is a real need. Arabic and English posts appear side by side, each with `dir="auto"`, and mixed-script names are common. Most of these Western tools do not document how they handle it.

### Gaps
- Searches for RTL support in Perusall, Padlet and Ed returned nothing relevant. The vendors' help centres were not checked one by one.
- Interface translation and machine translation of posts in Canvas and Teams: not verified.

## 6. Pricing, licensing, open source and embedding (LTI/API)

### Takeaway
Most tools are commercial SaaS. They are licensed per student, per course or per institution, and they integrate with an LMS through LTI. Free options:
- Kialo Edu is free for educators.
- Hypothesis has a free tier and an open-source codebase.
- Piazza has a free contribution-based tier, with premium features behind paid licences.

Minerva Forum is available only through institutional partnership. None of these tools is easy to embed into a custom Next.js app with CILAS's own users and bilingual UI. The realistic embedding candidate is Hypothesis, for annotation on articles and readings.

### Cited Findings
- **Piazza:**
  - Paid licences since 2021, and premium features are paywalled.
  - Reported prices of $379–$479 per instructor per term, and $9,000 or $12,000 per year per department.
  - Free for classes of 25 students or fewer and for K-12. Pricing is not published officially.
  - Sources: [Piazza support](https://support.piazza.com/support/solutions/articles/48001161300-paid-model-for-piazza-q-a); [yespress.io](https://yespress.io/piazza); [Capterra](https://www.capterra.com/p/209735/Piazza/). Capterra's "$10/user/year" conflicts with the other figures.
- **Hypothesis:** a free tier (core annotation and private groups) and paid tiers priced per student per year, which add LMS integration and analytics. No dollar figures were found. — [Hypothesis packages](https://web.hypothes.is/pricing-page/)
- **Kialo Edu:** free for educators. It runs inside Canvas and Blackboard as an external app. — [Rutgers Canvas](https://canvas.rutgers.edu/external-apps/kialo-edu/); [Blackboard app catalog](https://appcatalog.blackboard.com/details/kialo-discussion)
- **Minerva Forum:** institutional partnership only, with no public API or developer portal (secondary source). — [apis.io](https://apis.io/providers/minerva-project/)
- **FeedbackFruits:** LMS-integrated. At least Yale dropped it at the end of 2025. — [Yale](https://poorvucenter.yale.edu/teaching/canvas-yale/instructional-tools/feedbackfruits-discussion-on-work)
- **Campuswire:** still listed as active. It raised a later-stage round in March 2026 and is part of "Campus Group". — [PitchBook](https://pitchbook.com/profiles/company/177180-40); [campusgroup.co](https://campusgroup.co/)

### Inferences
- CILAS does not use a third-party LMS. LTI-based tools would therefore need CILAS to act as an LTI platform, which is a large job. Building the core features in-house (Q&A endorsement, peer-only anonymity, categories per session, polls, reactions, fellow badges, participation summary) is likely cheaper than integrating. Hypothesis is the one tool where embedding an open-source client could make sense, for annotating CILAS articles and readings.

### Gaps
- Ed Discussion's pricing, ownership and possible acquisition: searches returned nothing.
- Prices for Yellowdig, Packback, Perusall and Padlet were not retrieved.
- Current status of Campuswire's product (not company funding), and whether Minerva Forum is sold to institutions outside Minerva's partners in 2025–26: not confirmed.
