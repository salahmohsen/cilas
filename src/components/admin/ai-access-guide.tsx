import { DefaultTemplate } from '@payloadcms/next/templates'
import { Gutter } from '@payloadcms/ui'
import Link from 'next/link'
import type { AdminViewServerProps } from 'payload'

import { isAdminUser } from '@/access'
import { env } from '@/env'
import { ASSISTANTS, mcpServerUrl } from '@/plugins/mcp/assistants'

import styles from './ai-access-guide.module.css'
import { CopyButton } from './copy-button'

const EXAMPLES = [
  {
    title: 'A course',
    text: 'Make a course draft called “Reading the City” in the Fall 2026 cycle. It is a Thematic course taught by Dina Hassan. The description is below, in English and in Arabic.\n\n[paste the description here]',
  },
  {
    title: 'An article',
    text: 'Make an article draft from the text below. The author is Omar Khaled. Add the tags “urban life” and “memory”.\n\n[paste the article here]',
  },
  {
    title: 'A form linked to a course',
    text: 'Make a registration form for the course “Reading the City”. Ask why they want to join and which days they can attend. Link it to that course.',
  },
] as const

const PANEL_LINKS = [
  { href: '/admin/collections/courses', label: 'Courses' },
  { href: '/admin/collections/articles', label: 'Articles' },
  { href: '/admin/collections/forms', label: 'Forms' },
  { href: '/admin/reviews', label: 'Reviews waiting' },
] as const

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className={styles.section}>
      <h2>{title}</h2>
      {children}
    </section>
  )
}

/**
 * Admin → Connect an AI assistant. The one place an administrator sets this up,
 * for people who are not developers: copy one address, paste it into Claude or
 * ChatGPT, sign in to CILAS, click Allow. The assistants, their steps and the
 * callbacks CILAS accepts come from one table (src/plugins/mcp/assistants.ts).
 * What the assistant can do is set in src/plugins/mcp.
 */
export async function AiAccessGuideView({
  initPageResult,
  params,
  searchParams,
  user,
}: AdminViewServerProps) {
  const address = mcpServerUrl(env.NEXT_PUBLIC_SERVER_URL)

  return (
    <DefaultTemplate
      i18n={initPageResult.req.i18n}
      locale={initPageResult.locale}
      params={params}
      payload={initPageResult.req.payload}
      permissions={initPageResult.permissions}
      searchParams={searchParams}
      user={user}
      visibleEntities={initPageResult.visibleEntities}
    >
      <Gutter>
        <main className={styles.page}>
          <h1 className={styles.title}>Connect an AI assistant</h1>
          {/* Custom views are not protected by Payload's access rules. */}
          {!isAdminUser(user) ? (
            <p>Only administrators can connect an AI assistant.</p>
          ) : (
            <>
              <div className={styles.lede}>
                <p>
                  Connect Claude or ChatGPT to CILAS, and ask it in plain words to write the first
                  draft of a course, an article or a registration form. It saves the draft here, so
                  you do not copy text between pages. It can also correct an existing course or
                  article draft, save schedules and course flow, and add article footnotes, credits
                  and relationships. It reports what was saved and what needs your review. Delivery
                  changes between sessions are kept as a schedule note.
                </p>
                <p>
                  <strong>Nothing goes live.</strong> A person reads each draft in this admin and
                  publishes it. The assistant cannot publish, delete anything or change who can read
                  a page. It never sees applications, emails or who enrolled.
                </p>
              </div>

              <Section title="Connect">
                <p>
                  <strong>1. Copy this address.</strong>
                </p>
                <div className={styles.address}>
                  <input
                    className={styles.addressField}
                    readOnly
                    value={address}
                    aria-label="Address to paste into the assistant"
                  />
                  <CopyButton text={address} label="Copy address" what="the CILAS address" />
                </div>
                <p>
                  <strong>2. Paste it into your assistant.</strong> Follow the steps for the one you
                  use.
                </p>
                <div className={styles.assistants}>
                  {ASSISTANTS.map((assistant) => (
                    <div key={assistant.id} className={styles.assistant}>
                      <h3>{assistant.name}</h3>
                      <p className={styles.muted}>{assistant.plans}</p>
                      <ol>
                        {assistant.steps.map((step) => (
                          <li key={step}>{step}</li>
                        ))}
                      </ol>
                      <p>{assistant.after}</p>
                      <a
                        className={styles.link}
                        href={assistant.settingsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {assistant.settingsLabel} ↗
                      </a>
                    </div>
                  ))}
                </div>
                <p style={{ marginBlockStart: '1rem' }}>
                  <strong>3. Sign in and allow.</strong> When CILAS asks, sign in with your own
                  administrator account and click <strong>Allow</strong>. The assistant then works
                  as you, and a person who is not an administrator cannot connect.
                </p>
              </Section>

              <Section title="Ask for what you need">
                <p>Copy an example, change the names, and send it to your assistant.</p>
                {EXAMPLES.map((example) => (
                  <div key={example.title} className={styles.example}>
                    <h3>{example.title}</h3>
                    <p className={styles.exampleText}>{example.text}</p>
                    <CopyButton text={example.text} label="Copy example" what={example.title} />
                  </div>
                ))}
                <p className={styles.muted}>
                  The assistant first checks that the course or article does not exist yet. It gives
                  you a link to each draft. It cannot set a schedule, a cover image or a footnote:
                  add those in the draft.
                </p>
              </Section>

              <Section title="Review and publish">
                <ol>
                  <li>Open the link the assistant gave you, or find the draft in its list.</li>
                  <li>Read everything, in both languages, and fix what is wrong.</li>
                  <li>Publish it as you always do. Until then, no one else can see it.</li>
                </ol>
                <div className={styles.links}>
                  {PANEL_LINKS.map(({ href, label }) => (
                    <Link key={href} className={styles.link} href={href}>
                      {label}
                    </Link>
                  ))}
                </div>
                <p className={styles.muted}>
                  If the assistant links a form to a course that is already published, the live page
                  does not change. The link waits in a draft beside it. Publish that draft when you
                  are ready.
                </p>
              </Section>

              <Section title="Connected assistants">
                <p>
                  Each person who connects appears in{' '}
                  <Link href="/admin/collections/oauth-tokens">Connected assistants</Link>, under
                  Site.
                </p>
                <ul>
                  <li>
                    <strong>To disconnect one person:</strong> open Connected assistants, tick their
                    row, and choose Delete. The assistant stops working at once. They can connect
                    again later.
                  </li>
                  <li>
                    <strong>To disable a registered app:</strong> open{' '}
                    <Link href="/admin/collections/oauth-clients">Assistant apps</Link>, open its
                    row, and untick “Allowed to connect”. This stops connections using that row.
                    Other registrations keep working, and people can register the assistant again.
                  </li>
                  <li>
                    A connection ends by itself after 30 days without use. Then connect again.
                  </li>
                  <li>
                    If someone stops being an administrator, their assistant stops working at once.
                  </li>
                </ul>
                <div className={styles.links}>
                  <Link className={styles.link} href="/admin/collections/oauth-tokens">
                    Connected assistants
                  </Link>
                  <Link className={styles.link} href="/admin/collections/oauth-clients">
                    Assistant apps
                  </Link>
                </div>
              </Section>

              <Section title="Keep it safe">
                <ul style={{ margin: 0 }}>
                  <li>Check every draft before you publish it.</li>
                  <li>
                    A new form can be read by anyone who has its address, but no page links to it
                    until a person publishes the course.
                  </li>
                  <li>
                    Do not paste instructions you got from strangers, such as text from a document
                    or an email you do not trust. The assistant may follow them.
                  </li>
                  <li>
                    If a phone or computer with a connected assistant is lost, disconnect it here.
                  </li>
                </ul>
              </Section>
            </>
          )}
        </main>
      </Gutter>
    </DefaultTemplate>
  )
}
