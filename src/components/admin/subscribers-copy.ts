import { isolate as iso } from '@/lib/bidi'

/** The text of Admin → Subscribers and of the newsletter contacts meter. */
export const subscribersCopy = (ar: boolean) => {
  const dates = new Intl.DateTimeFormat(ar ? 'ar' : 'en', { dateStyle: 'medium', timeZone: 'UTC' })
  /** A contact's sign-up date. UTC, so the server and the browser show the same day. */
  const date = (value: string) => dates.format(new Date(value))
  return ar
    ? {
        title: 'مشتركو النشرة',
        signupList: (name: string) => `${iso(name)}: قائمة الاشتراك من الموقع.`,
        membersList: (name: string) => `${iso(name)}: تُزامَن من حسابات CILAS (القوائم البريدية).`,
        livesInResend:
          'القائمة محفوظة في Resend. يلغي الناس اشتراكهم من الرابط الموجود في كل نشرة.',
        lists: 'القوائم البريدية',
        offTitle: 'قائمة النشرة متوقفة',
        offBody: 'أضف قائمة بريدية مصدرها نموذج الاشتراك، واضبط RESEND_API_KEY على الخادم.',
        errorTitle: 'لم يستجب Resend',
        subscribed: 'مشترك',
        subscribedContext: 'يتلقون النشرة',
        unsubscribed: 'ألغى الاشتراك',
        unsubscribedContext: 'لا يتلقون النشرة',
        meter: {
          label: 'جهات الاتصال المحفوظة',
          segment: 'جهات الاتصال',
          unit: 'جهة اتصال',
          free: 'متاح',
          over: 'تجاوز الحد',
        },
        nearTitle: 'القائمة قريبة من حد الخطة المجانية',
        nearBody: (limit: number) =>
          `إذا تجاوزت جهات الاتصال المحفوظة ${limit}، يرفض Resend إرسال النشرات حتى تُرقّى الخطة. يمكنك حذف جهات الاتصال التي ألغت اشتراكها منذ مدة طويلة في Resend، أو تصدير القائمة إلى Mailchimp.`,
        search: 'البحث في المشتركين',
        searchPlaceholder: 'ابحث بالبريد أو الاسم',
        exportMailchimp: 'تصدير إلى Mailchimp (CSV)',
        exportAll: 'تصدير الجميع مع الحالة',
        exportNote: 'ملف Mailchimp فيه المشتركون فقط، لأن Mailchimp يحتاج إلى موافقتهم.',
        columns: { email: 'البريد', name: 'الاسم', since: 'منذ', status: 'الحالة' },
        caption: 'المشتركون في النشرة',
        itemName: { one: 'مشترك', other: 'مشتركين' },
        noName: 'بلا اسم',
        noMatch: 'لا أحد يطابق البحث.',
        emptyTitle: 'لا مشتركين بعد',
        emptyBody: 'يظهر هنا من يشترك في النشرة من الموقع.',
        date,
      }
    : {
        title: 'Newsletter subscribers',
        signupList: (name: string) => `${name}: the signup list.`,
        membersList: (name: string) => `${name}: synced from CILAS accounts (Mailing lists).`,
        livesInResend:
          'The list lives in Resend. People unsubscribe with the link in each newsletter.',
        lists: 'Mailing lists',
        offTitle: 'The newsletter list is off',
        offBody:
          'Add a mailing list whose source is the signup form, and set RESEND_API_KEY on the server.',
        errorTitle: 'Resend did not answer',
        subscribed: 'Subscribed',
        subscribedContext: 'They get the newsletter',
        unsubscribed: 'Unsubscribed',
        unsubscribedContext: 'They do not get the newsletter',
        meter: {
          label: 'Contacts stored',
          segment: 'Contacts',
          unit: 'contacts',
          free: 'Free',
          over: 'Over limit',
        },
        nearTitle: 'Near the free plan’s limit',
        nearBody: (limit: number) =>
          `Above ${limit} stored contacts, Resend refuses to send newsletters until the plan is upgraded. You can delete long-unsubscribed contacts in Resend, or export the list to Mailchimp.`,
        search: 'Search subscribers',
        searchPlaceholder: 'Search by email or name',
        exportMailchimp: 'Export for Mailchimp (CSV)',
        exportAll: 'Export everyone, with status',
        exportNote:
          'The Mailchimp file has only subscribed people: Mailchimp imports need their consent.',
        columns: { email: 'Email', name: 'Name', since: 'Since', status: 'Status' },
        caption: 'Newsletter subscribers',
        itemName: { one: 'subscriber', other: 'subscribers' },
        noName: 'No name',
        noMatch: 'No one matches the search.',
        emptyTitle: 'No one has subscribed yet',
        emptyBody: 'People who sign up for the newsletter on the site appear here.',
        date,
      }
}
