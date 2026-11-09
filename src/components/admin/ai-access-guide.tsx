import { DefaultTemplate } from '@payloadcms/next/templates'
import { Gutter } from '@payloadcms/ui'
import Link from 'next/link'
import type { AdminViewServerProps } from 'payload'

import { isAdminUser } from '@/access'
import { env } from '@/env'

const muted = { color: 'var(--theme-elevation-500)' } as const
const box = { padding: '16px 20px', margin: '0 0 24px' } as const
const code = {
  display: 'block',
  padding: '12px 16px',
  overflowX: 'auto',
  whiteSpace: 'pre',
  background: 'var(--theme-elevation-100)',
  borderRadius: '4px',
  fontSize: '13px',
} as const

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="cilas-admin-box" style={box}>
      <h2 style={{ margin: '0 0 8px', fontSize: '18px' }}>{title}</h2>
      {children}
    </section>
  )
}

/**
 * Admin → AI access guide: what the feature does, how to make a key, how to
 * connect an assistant, and what to keep safe. For administrators who are not
 * developers. The tools and limits named here are those of src/plugins/mcp.
 */
export async function AiAccessGuideView({
  initPageResult,
  params,
  searchParams,
  user,
}: AdminViewServerProps) {
  const endpoint = `${env.NEXT_PUBLIC_SERVER_URL.replace(/\/$/, '')}/api/mcp`
  const desktopConfig = JSON.stringify(
    {
      mcpServers: {
        cilas: {
          command: 'npx',
          args: ['-y', 'mcp-remote', endpoint, '--header', 'Authorization: Bearer YOUR-KEY'],
        },
      },
    },
    null,
    2,
  )
  const claudeCode = `claude mcp add --transport http cilas ${endpoint} \\\n  --header "Authorization: Bearer YOUR-KEY"`

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
        <h1 style={{ margin: '24px 0 8px' }}>AI access guide</h1>
        {/* Custom views are not protected by Payload's access rules. */}
        {!isAdminUser(user) ? (
          <p>Only admins can use AI access.</p>
        ) : (
          <>
            <p style={{ ...muted, marginTop: 0 }}>
              <Link href="/admin/collections/payload-mcp-api-keys">← Your keys</Link>
            </p>

            <Section title="What it does">
              <p style={{ marginTop: 0 }}>
                You connect an AI assistant, such as Claude, to this site. Then you ask it, in plain
                words, to make things for you. It can:
              </p>
              <ul>
                <li>write a first draft of a course, in English and Arabic,</li>
                <li>write a first draft of an article, in English and Arabic,</li>
                <li>
                  make a registration form and link it to a course, with no copying between pages.
                </li>
              </ul>
              <p>
                It saves time on first drafts. <strong>Nothing goes live.</strong> The assistant
                only makes drafts. A person has to open each draft here, read it, and publish it.
                The assistant cannot publish, delete, or change who may read a page.
              </p>
              <p style={{ marginBottom: 0 }}>
                It can also look things up, such as cycles, teachers and existing courses, so it
                does not make a duplicate. It sees only names, titles and ids. It never sees emails,
                applications or who enrolled.
              </p>
            </Section>

            <Section title="1. Make a key">
              <ol style={{ marginTop: 0 }}>
                <li>
                  Open{' '}
                  <Link href="/admin/collections/payload-mcp-api-keys/create">
                    AI access → Create new
                  </Link>
                  .
                </li>
                <li>Give the key a label, for example “Claude on my laptop”.</li>
                <li>
                  Switch on the API key and generate it. Copy the key and save it somewhere safe
                  before you save the page. The site stores it in a form it cannot show again, so if
                  you lose it, make a new key.
                </li>
              </ol>
              <p style={{ marginBottom: 0 }}>
                The key works as you. If an admin takes your admin role away, the key stops working
                at once. You see only your own keys.
              </p>
            </Section>

            <Section title="2. Connect your assistant">
              <p style={{ marginTop: 0 }}>
                The address of the server is <strong>{endpoint}</strong>. Replace YOUR-KEY with the
                key you copied.
              </p>
              <h3 style={{ fontSize: '15px' }}>Claude Desktop</h3>
              <p>
                Open Settings → Developer → Edit config, add this, save, and restart Claude. It
                needs Node.js on your computer, because it runs a small helper called mcp-remote.
              </p>
              <code style={code}>{desktopConfig}</code>
              <h3 style={{ fontSize: '15px' }}>Claude Code</h3>
              <p>Run this once in a terminal:</p>
              <code style={code}>{claudeCode}</code>
            </Section>

            <Section title="3. Ask for what you need">
              <p style={{ marginTop: 0 }}>Examples of what to say:</p>
              <ul style={{ marginBottom: 0 }}>
                <li>“Make a course draft for the Fall 2026 cycle called ‘Reading the City’.”</li>
                <li>
                  “Here is the syllabus text. Make a Thematic course draft taught by Dina Hassan.
                  English and Arabic are below.”
                </li>
                <li>“Make an article draft from this essay. The author is Omar Khaled.”</li>
                <li>
                  “Make a registration form for the Reading the City course. Ask why they want to
                  join and which days they can attend.”
                </li>
              </ul>
              <p style={{ marginBottom: 0 }}>
                The assistant checks for an existing course first. It tells you the link to each
                draft. Anything it cannot set, such as the schedule, the cover image or a footnote,
                you add in the admin.
              </p>
            </Section>

            <Section title="4. Review and publish">
              <ol style={{ marginTop: 0 }}>
                <li>Open the link the assistant gave you, or find the draft in its list.</li>
                <li>Read everything, in both languages. Fix what is wrong.</li>
                <li>
                  Publish it as you always do. Courses and articles stay hidden until you publish.
                </li>
              </ol>
              <p style={{ marginBottom: 0 }}>
                If a form is linked to a course that is already published, the live page does not
                change. The link waits in a draft beside it. Publish that draft when you are ready.
              </p>
            </Section>

            <Section title="Keep it safe">
              <ul style={{ margin: 0 }}>
                <li>Do not share a key. Treat it like your password.</li>
                <li>
                  If you lose a key, or think someone has it, delete it here at once. Make a new
                  one.
                </li>
                <li>Keys do not expire. Delete the ones you no longer use.</li>
                <li>
                  Do not use the key in an AI assistant that also has email or sending tools. A
                  document or web page it reads could trick it into sending things.
                </li>
                <li>Check every draft before you publish it.</li>
              </ul>
            </Section>
          </>
        )}
      </Gutter>
    </DefaultTemplate>
  )
}
