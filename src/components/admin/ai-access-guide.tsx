import Link from 'next/link'
import type { AdminViewServerProps } from 'payload'

import { isAdminUser } from '@/access'
import { env } from '@/env'
import { ASSISTANTS } from '@/plugins/mcp/assistants'
import { mcpServerUrl } from '@/plugins/mcp/paths'

import styles from './ai-access-guide.module.css'
import { Accordion } from '@/components/arc/accordion/accordion'
import { Alert } from '@/components/arc/alert/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/arc/tabs/tabs'

import { ArcAdminView } from './arc-admin-view'
import { AddressCopy, ExampleCopy } from './ai-access-copy'

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

/** Admin → AI access guide. In English only, like the assistants it explains. */
export async function AiAccessGuideView(view: AdminViewServerProps) {
  const address = mcpServerUrl(env.NEXT_PUBLIC_SERVER_URL)

  return (
    <ArcAdminView
      view={view}
      language="en"
      title="Connect an AI assistant"
      allowed={isAdminUser(view.user)}
    >
      <div className={styles.page}>
        <div className={styles.lede}>
          <p>
            Connect Claude or ChatGPT to CILAS, and ask it in plain words to write the first draft
            of a course, an article or a registration form. It saves the draft here, so you do not
            copy text between pages. It can also correct an existing course or article draft, save
            schedules and course flow, and add article footnotes, credits and relationships. It
            reports what was saved and what needs your review. It can save a separate delivery mode
            for each session.
          </p>
          <Alert tone="info" title="Course and article drafts need your review">
            A person reads each course or article draft in this admin and publishes it. A new form
            is readable by anyone who has its address. The assistant cannot publish, delete anything
            or change who can read a page. It never sees applications, emails or who enrolled.
          </Alert>
        </div>

        <Section title="Connect">
          <p>
            <strong>1. Copy this address.</strong>
          </p>
          <AddressCopy address={address} />
          <p>
            <strong>2. Paste it into your assistant.</strong> Follow the steps for the one you use.
          </p>
          <Tabs defaultValue={ASSISTANTS[0].id}>
            <TabsList aria-label="Assistant setup">
              {ASSISTANTS.map((assistant) => (
                <TabsTrigger key={assistant.id} value={assistant.id}>
                  {assistant.name}
                </TabsTrigger>
              ))}
            </TabsList>
            {ASSISTANTS.map((assistant) => (
              <TabsContent key={assistant.id} value={assistant.id} className={styles.assistant}>
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
              </TabsContent>
            ))}
          </Tabs>
          <p style={{ marginBlockStart: '1rem' }}>
            <strong>3. Sign in and allow.</strong> When CILAS asks, sign in with your own
            administrator account and click <strong>Allow</strong>. The assistant then works as you,
            and a person who is not an administrator cannot connect.
          </p>
        </Section>

        <Section title="Ask for what you need">
          <p>Copy an example, change the names, and send it to your assistant.</p>
          <Tabs defaultValue={EXAMPLES[0].title}>
            <TabsList aria-label="Example prompts">
              {EXAMPLES.map((example) => (
                <TabsTrigger key={example.title} value={example.title}>
                  {example.title}
                </TabsTrigger>
              ))}
            </TabsList>
            {EXAMPLES.map((example) => (
              <TabsContent key={example.title} value={example.title}>
                <ExampleCopy title={example.title} text={example.text} />
              </TabsContent>
            ))}
          </Tabs>
          <p className={styles.muted}>
            The assistant first checks that the course or article does not exist yet. It gives you a
            link to each draft. Review its schedule, cover image and footnotes in the draft before
            publishing.
          </p>
        </Section>

        <Section title="Review and publish">
          <ol>
            <li>Open the link the assistant gave you, or find the draft in its list.</li>
            <li>Read everything, in both languages, and fix what is wrong.</li>
            <li>
              Publish the course or article as you always do. Its draft stays unpublished until
              then. Forms are readable by address as soon as they are created.
            </li>
          </ol>
          <div className={styles.links}>
            {PANEL_LINKS.map(({ href, label }) => (
              <Link key={href} className={styles.link} href={href}>
                {label}
              </Link>
            ))}
          </div>
          <p className={styles.muted}>
            If the assistant links a form to a course that is already published, the live page does
            not change. The link waits in a draft beside it. Publish that draft when you are ready.
          </p>
        </Section>

        <Section title="Connected assistants">
          <Accordion
            defaultOpen={-1}
            items={[
              {
                title: 'Connected assistants',
                content: (
                  <div className={styles.prose}>
                    <p>
                      Each person who connects appears in{' '}
                      <Link href="/admin/collections/oauth-tokens">Connected assistants</Link>,
                      under Site.
                    </p>
                    <ul>
                      <li>
                        <strong>To disconnect one person:</strong> open Connected assistants, tick
                        their row, and choose Delete. The assistant stops working at once. They can
                        connect again later.
                      </li>
                      <li>
                        <strong>To disable a registered app:</strong> open{' '}
                        <Link href="/admin/collections/oauth-clients">Assistant apps</Link>, open
                        its row, and untick “Allowed to connect”. This stops connections using that
                        row. Other registrations keep working, and people can register the assistant
                        again.
                      </li>
                      <li>
                        A connection ends by itself after 30 days without use. Then connect again.
                      </li>
                      <li>
                        If someone stops being an administrator, their assistant stops working at
                        once.
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
                  </div>
                ),
              },
            ]}
          />
        </Section>

        <Section title="Keep it safe">
          <ul style={{ margin: 0 }}>
            <li>Check every draft before you publish it.</li>
            <li>
              A new form can be read by anyone who has its address, but no page links to it until a
              person publishes the course.
            </li>
            <li>
              Do not paste instructions you got from strangers, such as text from a document or an
              email you do not trust. The assistant may follow them.
            </li>
            <li>If a phone or computer with a connected assistant is lost, disconnect it here.</li>
          </ul>
        </Section>
      </div>
    </ArcAdminView>
  )
}
