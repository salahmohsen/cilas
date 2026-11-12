import type { QueueKind } from '@/lib/review-queue'

const DAY = 86_400_000

/** The text of Admin → Reviews and of the dashboard box that lists the same queue. */
export const reviewsCopy = (ar: boolean) => {
  const days = new Intl.RelativeTimeFormat(ar ? 'ar' : 'en', { numeric: 'auto' })
  /** "today", "yesterday", "3 days ago", from an ISO date and the time of the request. */
  const waited = (since: string, now: number) =>
    days.format(-Math.floor((now - Date.parse(since)) / DAY), 'day')
  return ar
    ? {
        title: 'بانتظار المراجعة',
        intro: 'المقالات والمقررات والمنشورات المرسلة للمراجعة، الأقدم أولًا.',
        applicantsNote: 'الطلبات في صفحة',
        applicantsLink: 'المتقدمون',
        kinds: { article: 'مقال', course: 'مقرر', publication: 'منشور' } satisfies Record<
          QueueKind,
          string
        >,
        columns: { kind: 'النوع', title: 'العنوان', by: 'من', since: 'أُرسل' },
        caption: 'المحتوى بانتظار المراجعة',
        itemName: { one: 'عنصر', other: 'عناصر' },
        untitled: 'بلا عنوان',
        removal: 'طلب حذف من الموقع',
        nobody: 'غير معروف',
        emptyTitle: 'لا شيء بانتظار المراجعة',
        emptyBody: 'تظهر هنا المقالات والمقررات والمنشورات عندما يرسلها أحد للمراجعة.',
        all: 'عرض الكل',
        waited,
      }
    : {
        title: 'Waiting for review',
        intro: 'Articles, courses and publications submitted for review. The oldest first.',
        applicantsNote: 'Applications are on the page',
        applicantsLink: 'Applicants',
        kinds: {
          article: 'Article',
          course: 'Course',
          publication: 'Publication',
        } satisfies Record<QueueKind, string>,
        columns: { kind: 'Type', title: 'Title', by: 'From', since: 'Sent' },
        caption: 'Content waiting for review',
        itemName: { one: 'item', other: 'items' },
        untitled: 'Untitled',
        removal: 'Asks to remove from the site',
        nobody: 'Unknown',
        emptyTitle: 'Nothing waits for review',
        emptyBody: 'Articles, courses and publications appear here when someone submits them.',
        all: 'See all',
        waited,
      }
}

export type ReviewsCopy = ReturnType<typeof reviewsCopy>
