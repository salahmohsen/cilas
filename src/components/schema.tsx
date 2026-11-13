import { CONTEXT } from '@/lib/schema'

/**
 * Several items as one object: a single @context over an @graph of them.
 * A bare array is valid JSON-LD too, but some readers (browser extensions
 * among them) take the script for one object and crash on its @context.
 */
const single = (data: object | object[]): object =>
  Array.isArray(data)
    ? {
        '@context': CONTEXT,
        '@graph': data.map((item) => {
          const { '@context': _context, ...node } = item as Record<string, unknown>
          return node
        }),
      }
    : data

/**
 * A page's structured data as one script of JSON-LD (schema.org). It can sit
 * anywhere in the `<body>`: Google reads every script of this type on a page.
 * Server components only — it has nothing for a browser to run.
 */
export const Schema = ({ data }: { data: object | object[] }) => (
  <script
    type="application/ld+json"
    // A `</script>` sequence inside the JSON would close the tag early.
    dangerouslySetInnerHTML={{ __html: JSON.stringify(single(data)).replace(/</g, '\\u003c') }}
  />
)
