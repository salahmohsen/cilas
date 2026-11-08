# Community platforms, embedded SDKs, and native build options for CILAS groups

Research note scope: (a) adopt a community platform, (b) embed a commercial SDK, (c) build natively on Next.js + Payload 3 + Postgres. Research date: 2026-10-20. The web search tool hit a rate limit during this work, so coverage is uneven. Items that this note could not verify are in the Gaps sections. Statements marked "[unverified, background knowledge]" are from the researcher's prior knowledge, not from a fetched source. Treat them as leads to check, not as facts.

## For each community platform: education use, SSO/integration, features, Arabic/RTL, self-hosting, pricing 2025–2026, data ownership

### Takeaway

Of the platforms checked, Discourse is the best fit for an "adopt" path. It is open source, it can be self-hosted on Docker at no licence cost, it supports SSO with the app as the identity provider and group sync, it allows full backup and export, and hosted plans have an 85% education discount. Circle and Mighty Networks are closed SaaS products for creators. They cost US$79–354+/month, charge transaction fees, and give limited or plan-gated API and SSO. Zulip is cheap or free for education, but it is a chat tool, not a forum.

### Cited Findings

**Discourse**

- Hosted plans (official page, fetched October 2026): Free $0 (2 staff, 500k page views, 20k emails/month, 5 GB); Pro $100/month (5 staff, 100k emails, 20 GB, API and webhooks); Business $500/month (15 staff, 300k emails, 100 GB, SSO "Open ID & OAuth2"); Enterprise custom. Members are unlimited on all plans. — [Discourse pricing](https://www.discourse.org/pricing)
- The Business tier rose from $300 to $500/month on 16 June 2026, according to an aggregator. The official page now shows $500, which agrees. — [CostBench changelog](https://costbench.com/changelog/discourse-price-increase-2026-06/); [Discourse pricing](https://www.discourse.org/pricing)
- Education discount: 85% off Pro or Business. It requires a government document that shows a registered, degree-granting institution, and confirmation that Discourse is the main forum or part of a degree track. The non-profit discount is 50% and requires proof of tax exemption, for example a 501(c)(3) letter. — [Discourse pricing](https://www.discourse.org/pricing)
- Data ownership: "You can back up all your data from your browser at any time and migrate to or from any cloud provider." The software is open source and free to self-host. Hosted Pro and Business trials let you choose Global or Europe hosting. — [Discourse pricing](https://www.discourse.org/pricing)
- DiscourseConnect SSO: the external site (for CILAS, the Payload app) is the identity provider. Discourse redirects to it with a signed payload. The protocol is specific to Discourse, not OAuth2 or OIDC, so the app needs custom code. Required fields are nonce, a verified email, and external_id. Optional fields include username, name, bio, avatar_url, locale, the admin/moderator flags, and `custom.*` fields. — [Meta: Setup DiscourseConnect](https://meta.discourse.org/t/setup-discourseconnect-official-single-sign-on-for-discourse-sso/13045)
- Group sync through DiscourseConnect: `add_groups` and `remove_groups` always apply. `groups` replaces the full group list when "discourse connect overrides groups" is on. Only manual groups change, not automatic or trust-level groups. `POST /admin/users/sync_sso` pushes updates without a login, for example when an enrollment changes. — [Meta: Setup DiscourseConnect](https://meta.discourse.org/t/setup-discourseconnect-official-single-sign-on-for-discourse-sso/13045)
- Hosted DiscourseConnect is "offered to pro, business, and enterprise hosting customers". The pricing page lists SSO explicitly only under Business, so this conflicts for Pro. Self-hosting has no such limit. — [Meta: Setup DiscourseConnect](https://meta.discourse.org/t/setup-discourseconnect-official-single-sign-on-for-discourse-sso/13045); [Discourse pricing](https://www.discourse.org/pricing)
- Arabic/RTL: a Meta thread says that Discourse translates through Transifex, that Arabic was 88% translated at that time, and that "recent work has been done… to improve RTL support in general". The thread date is unclear and is probably old. — [Meta: Current status of Arabic text support?](https://meta.discourse.org/t/current-status-of-arabic-text-support/33288)

**Circle**

- Professional plan: $89/month billed annually, $129 billed monthly. Business: $199 annual / $219 monthly. Plus/Enterprise: custom, about $360–419/month. Transaction fees: 2% / 1% / 0.5%. Sources disagree about the top tier. An aggregator logged an increase to $399 in April 2026 and a decrease back to $199 in June 2026. — [Schoolmaker](https://schoolmaker.com/blog/circle-so-pricing); [CartMango](https://cartmango.com/circle-so-pricing/); [CostBench Apr](https://costbench.com/changelog/circle-price-increase-2026-04/); [CostBench Jun](https://costbench.com/changelog/circle-price-decrease-2026-06/)
- The Circle origin story: course cohorts of 50–100 students ended up in Slack or Facebook groups, which was "very messy… not cohesive, and it's not very organized". — [Smart Passive Income](https://www.smartpassiveincome.com/how-creators-can-build-thriving-online-community-circle-so/)

**Mighty Networks** (official page, October 2026)

- Launch $79/month (3 hosts, 10 moderators, 2% fee, no admin API). Scale $179/month (5,000 admin API requests/month, "APIs & MCP Access", 1% fee). Growth $354/month (50k API requests, 0.5% fee). Mighty Pro is custom and includes a white-label app. Members are unlimited on all plans. SSO is not shown on the lower tiers. The page lists an annual Launch price of $950/year, which does not match the "2 months free" claim. — [Mighty Networks pricing](https://www.mightynetworks.com/pricing)

**Zulip** (official plans page)

- Cloud plans: Free (10,000-message search history, 5 GB). Standard $6.67/user/month annual. Plus $10/user/month with SAML and SCIM. Self-hosted: Free with all features. Paid tiers are needed for unlimited mobile push beyond eligible communities or 10 users. OIDC SSO and group sync are on Enterprise only. — [Zulip plans](https://zulip.com/plans/)
- Sponsorship: Zulip Cloud Standard is free for academic research, small nonprofits, and similar groups. Education organisations get discounted pricing. On self-hosted, the free Community plan is available to "many education and nonprofit organizations". Zulip sponsors more than 1,500 organisations. The plans page does not mention RTL. — [Zulip plans](https://zulip.com/plans/)

### Inferences

- Discourse is the strongest "adopt" option for a one-developer team. It is open source (GPL), and you can self-host it as a Docker container alongside Dokploy, but its official install uses its own launcher, so it is a second large Ruby/Redis/Postgres stack to maintain. With DiscourseConnect, Payload stays the identity source, and `add_groups`/`remove_groups` plus `sync_sso` can map enrollments to course groups. Fellows can become category moderators through group permissions. The cost is two UIs, two designs, and two notification systems. Discourse is a separate site, so linking threads to sessions needs embeds or links.
- Circle and Mighty Networks target creators who sell memberships. The transaction fees and the paywall features are not relevant to CILAS, and with these tools CILAS would not own the identity or the data model.
- Zulip's topic-threaded chat model is good for real-time discussion. It gives no polls-as-first-class or Q&A content and no public SEO surface, and it does not confirm RTL quality.
- [unverified, background knowledge] Discourse has a core polls feature, likes and reactions (through a plugin, which is now in core), solved answers (a plugin), trust levels, email digests ("activity summary"), full-text search on Postgres, and reply-by-email. Check these against current docs before quoting them.

### Gaps

- Not checked because of the search rate limit: Discord, Slack (free plan 90-day history limit and Pro pricing), Matrix/Element, Flarum, NodeBB, Heartbeat, Skool, Geneva, Bettermode. Pricing and features for these are not verified here.
- Discourse RTL quality in 2025–2026 (the Arabic UI, mixed bidi posts, the composer) has no recent source. The Meta thread is undated and probably old. Recommend a hands-on test with Arabic content on try.discourse.org.
- Not confirmed: whether the hosted Discourse Pro tier includes DiscourseConnect.
- Not found: Circle and Mighty Networks Arabic/RTL support, and their data-export scope.

## Lessons from cohort-based course companies and universities

### Takeaway

Small evidence base. The published reasons for leaving Slack are message overload and decay, too many tools (chat, events, and files in different places), a weak member directory, and poor analytics. Maven moved toward a community built into its course platform, which supports the "integrated" thesis. Forum-style tools give lower spontaneous engagement than chat.

### Cited Findings

- A newsletter community that moved from Slack to Circle gave these reasons. Slack is "synchronously asynchronous": members must scan every message, and returning after a break is hard. "Messages in Slack degrade much quicker than in community platforms." Chat (Slack), events (Lu.ma), and resources (Google Drive) were spread across tools that members could not find. The member directory was weak and "lacks the tags needed to find people". Analytics were missing. — [FML Studios / Careers in Tech](https://fmlstudios.substack.com/p/why-we-migrated-our-community-from)
- Downsides of the same move: Circle's forum structure is "a larger barrier for members to overcome", which reduced some engagement compared with Slack, and the Android app was weak. — [FML Studios](https://fmlstudios.substack.com/p/why-we-migrated-our-community-from)
- Maven offers a built-in community as the main space for students to chat, share work, and ask questions, with email alerts to instructors for tags and replies. Instructors can opt out and send students to an external community. — [Maven help: Community overview](https://help.maven.com/en/articles/6289166-community-overview)
- Older Maven guidance refers to a Maven Slack workspace with channels for each cohort. A 2026 review lists "async community (Slack or similar)" for a Maven course. — [Maven community guidelines](https://help.maven.com/en/articles/5776040-community-guidelines); [SkillScouter Maven review](https://skillscouter.com/maven-review/)

### Inferences

- The pattern: cohort operators start on Slack, which is free and familiar. They move to a platform built in or branded when tools multiply and content is lost. The same fragmentation argument favours putting discussions inside the CILAS app next to sessions and materials.
- The forum-versus-chat engagement trade-off is real. A native build should have a low-friction "quick reply" feel, not only a formal forum composer.

### Gaps

- No sources fetched for Reforge, altMBA/Akimbo, Minerva, On Deck, or universities (for example, Discourse used for MOOCs and courses). [unverified, background knowledge] altMBA has used its own platform for cohorts. Reforge and On Deck used Slack. Minerva uses its proprietary Forum platform for classes. None of these are confirmed here.
- No quantified engagement data (for example, posts per member before and after a migration) was found.

## Embedded SDKs: features, small-scale pricing, lock-in, data residency

### Takeaway

At CILAS scale (hundreds to low thousands of users), the free tiers are either too small or have conditions (Stream Feeds Build: 5,000 activities/month; Liveblocks Free: a hard cap of 200 comments). Paid tiers jump to about US$500–600/month for Stream. Liveblocks Pro is cheap ($25–30/month plus $0.01 per comment), but it is built for comments on documents, not community forums. Regional data residency is mostly Enterprise-only. Lock-in is high because the content lives in the vendor's store.

### Cited Findings

- Stream Activity Feeds: Build is free (125k API calls, 5,000 activities/month, no overage). Start is $499/month annual or $599 monthly (1.25M calls, 50k activities). Elevate is $899/$999. Enterprise is custom and adds dedicated regional servers, SSO, and audit logs. The page lists no MAU limit. A "Maker" account gives a $100/month credit to teams with fewer than 5 people and less than $10k/month revenue ("availability is limited"). CDN costs are $0.17/GB bandwidth and $0.07/GB storage. — [Stream Feeds pricing](https://getstream.io/activity-feeds/pricing/)
- Stream Chat: secondary sources give a free Build tier of about 1,000 MAU and 100 concurrent connections, and a paid entry tier of about $499/month at 10k MAU. These are not confirmed on the official page. — [Gappsy](https://gappsy.com/tools/getstream-io/); [CometChat comparison](https://www.cometchat.com/blog/stream-pricing-plans-review)
- Liveblocks: Free $0 (200 comments as a hard cap, 3,000 anonymous connections/month). Pro $25/month annual or $30 monthly, with $30 of credits, then $0.01 per comment and $0.005 per custom notification event. Team from $500–600/month. EU or US data residency is listed only for Enterprise. Data export is not stated on the pricing page. — [Liveblocks pricing](https://liveblocks.io/pricing)

### Inferences

- For CILAS, Stream Feeds Build (5k activities/month) could cover a small pilot, but posts, comments, and reactions all count as activities, so an active term could exceed it. After that, the price jumps to $499+/month. That is not economic for a small institute.
- Liveblocks Comments would be good for "discussion on a session page" (threads anchored to a room per session), with reactions and mentions. It has no polls, categories, digests, or forum moderation, so CILAS would still build much of the feature.
- All SDKs keep CILAS content outside its Postgres. Payload's review workflow ("promote a thread to an article") and search would then need sync or webhooks.

### Gaps

- Not fetched: Sendbird, CometChat, Velt, Knock, or Novu pricing (rate limit). [unverified, background knowledge] Novu is open source and can be self-hosted (MIT core), with digest and batching features. Knock has a free developer tier and paid plans by notification volume. Check both.
- No confirmed data on Arabic/RTL support in the prebuilt SDK UI kits.

## Native build on Next.js/Postgres: components, effort, risks, reusable OSS

### Takeaway

A native build needs about 8 components: posts/threads, comments, reactions, polls, moderation and reports, notifications with email digests (Resend already exists), web push, and real-time updates. Postgres covers search (tsvector) and real-time fan-out (LISTEN/NOTIFY to SSE). iOS web push works only for PWAs that are installed to the Home Screen (iOS 16.4+). Push is the main platform risk, and email digests stay the reliable channel.

### Cited Findings

- Web push on iOS arrived with iOS 16.4, but only for web apps that are added to the Home Screen. — [The Register](https://www.theregister.com/2024/02/08/apple_web_apps_eu/); [MagicBell guide](https://www.magicbell.com/blog/pwa-ios-limitations-safari-support-complete-guide)
- In February 2024 Apple said it would remove Home Screen web apps, and with them push, for EU users in iOS 17.4 under the DMA. It then reversed this: Apple "will continue to offer the existing Home Screen web apps capability in the EU". Some guides still say that EU push does not work, so the sources conflict. Egypt is outside the EU, so this matters only for EU-based members. — [Apple Developer Forums thread](https://developer.apple.com/forums/thread/745414?page=2); [Ionic blog](https://ionic.io/blog/a-note-on-ios-17-4-and-pwas); [MagicBell](https://www.magicbell.com/blog/pwa-ios-limitations-safari-support-complete-guide)
- Remaining PWA limits on iOS include hardware access, how long offline storage persists, background processing, and full-screen behaviour. — [MagicBell](https://www.magicbell.com/blog/pwa-ios-limitations-safari-support-complete-guide)

### Inferences (effort estimates are the researcher's judgment, not sourced)

- Data model in Payload: `groups` (kind: course | programme | community, with a relation to course or programme), `posts` (group, author, body as Lexical rich text, pinned, locked, status), `comments` (post, parent, author), `reactions` (a polymorphic target, user, emoji, and a unique constraint), `polls` + `pollOptions` + `pollVotes` (with a unique (poll, user) constraint for single choice), `reports`, and `notifications`/`subscriptions`. Membership comes from enrollments and programme memberships through access functions. Do not store a copy of the members.
- Real-time: SSE route handlers in Next.js with Postgres LISTEN/NOTIFY work on a single Dokploy container. For multiple replicas, each instance listens on its own connection. Polling every 15–30 s is an acceptable v1 for discussion that is not chat. Websockets are not needed.
- Search: Postgres full-text search with the `simple` config, or with separate Arabic and English handling. Postgres has no built-in Arabic stemmer in older versions, so check this. `pg_trgm` is a fallback that works for both languages.
- Notifications: in-app list + Resend daily or weekly digest (cron in Dokploy) + optional web push (VAPID through the `web-push` npm package). Push needs a service worker and a subscription table. iOS users must install the PWA first.
- Moderation for a closed, authenticated community: report button, hide/lock by fellows in course groups, and rate limits. Spam risk is low because membership comes from enrollment, so CAPTCHA and ML filters are probably unnecessary.
- Rough effort for one developer: an MVP (threads, comments, reactions, polls, fellow moderation, email digest) of 3–6 weeks. Add 1–2 weeks for push and SSE. Ongoing cost: moderation tools, notification preference UX, and edge cases in bidi text rendering.
- Unique advantages of building in the app: membership driven by enrollment, with no sync jobs; threads linked to sessions (for example, a "discuss this session" thread created for each session); one login and one design that is already bilingual and RTL-aware; profiles that stay private under existing access rules; promoting a thread to the existing Payload review workflow to become an article; and all data in CILAS's Postgres and backups.
- The fragmentation evidence above (members could not find chat, events, and resources across separate tools) supports the integrated build. It is one case study, so it is weak evidence.

### Gaps

- Open-source React/Next.js forum or comment components were not researched (rate limit). Candidates to check: [unverified] Remark42 and Commento/Comentario (embeddable self-hosted comments), Discourse's embed, Flarum/NodeBB as headless backends, and shadcn-based community templates. None of these were checked for maintenance status or RTL.
- No engineering-blog case studies on building community features were fetched.
- The status of Arabic text search in Postgres (the dictionary or stemmer in PG 16/17) was not verified.
