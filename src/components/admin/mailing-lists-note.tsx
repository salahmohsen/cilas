import Link from 'next/link'

/** Email settings → Newsletter: where the lists are now. */
export function MailingListsNote() {
  return (
    <p className="field-description" style={{ marginBlock: '1rem' }}>
      Who newsletters go to is set in{' '}
      <Link href="/admin/collections/mailing-lists" style={{ fontWeight: 600 }}>
        Mailing lists
      </Link>
      : the signup list for the public, and lists synced from members (roles, courses, programmes,
      chosen accounts). Each newsletter picks its list in “Send to”. The Resend API key stays a
      server setting (RESEND_API_KEY), as it is a secret.
    </p>
  )
}
