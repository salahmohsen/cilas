/**
 * A page's structured data as one script of JSON-LD (schema.org). It can sit
 * anywhere in the `<body>`: Google reads every script of this type on a page.
 * Server components only — it has nothing for a browser to run.
 */
export const Schema = ({ data }: { data: object | object[] }) => (
  <script
    type="application/ld+json"
    // A `</script>` sequence inside the JSON would close the tag early.
    dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }}
  />
)
