/** Wraps a name, title or address so it keeps its own direction inside Arabic text. */
const iso = (text: string) => `\u2068${text}\u2069`

export const applicantsCopy = (ar: boolean) =>
  ar
    ? {
        title: 'المتقدمون',
        course: 'المقرر',
        cycle: 'الدورة',
        status: 'الحالة',
        reduction: 'طلب تخفيض',
        yes: 'نعم',
        no: 'لا',
        add: 'إضافة تصفية',
        clear: 'مسح التصفيات',
        noFilters: 'لا توجد تصفيات',
        back: 'العودة',
        statuses: { new: 'قيد المراجعة', accepted: 'مقبول', rejected: 'مرفوض' },
        decisions: { pending: 'قيد المراجعة', accepted: 'مقبول', rejected: 'مرفوض' },
        review: 'مراجعة',
        accept: 'قبول',
        reject: 'رفض',
        reopen: 'إعادة فتح',
        resend: 'إرسال البريد مرة أخرى',
        accepting: 'جارٍ القبول',
        rejecting: 'جارٍ الرفض',
        reopening: 'جارٍ إعادة الفتح',
        resending: 'جارٍ الإرسال',
        reopened: 'أُعيد فتحه',
        emailNotSent: 'لم يُرسل البريد',
        cancel: 'إلغاء',
        close: 'إغلاق',
        acceptTitle: (title: string) => `قبول المتقدم في ${iso(title)}؟`,
        acceptBody: (name: string, title: string) => `قبول طلب ${iso(name)} في ${iso(title)}.`,
        rejectTitle: (title: string) => `رفض المتقدم في ${iso(title)}؟`,
        rejectBody: (name: string, title: string) => `رفض طلب ${iso(name)} في ${iso(title)}.`,
        reopenTitle: (title: string) => `إعادة فتح القرار في ${iso(title)}؟`,
        reopenBody: (name: string, title: string) =>
          `إعادة طلب ${iso(name)} في ${iso(title)} إلى قيد المراجعة.`,
        whatNext: 'ما الذي سيحدث بعد ذلك',
        acceptEffects: (email: string, title: string, programme: boolean) => [
          programme
            ? 'تتغير حالة الطلب إلى «مقبول» ويُحفظ تاريخ القرار.'
            : `يتغير قرار ${iso(title)} إلى «مقبول» ويُحفظ تاريخه.`,
          programme
            ? `تُنشأ عضوية للمتقدم في ${iso(title)}.`
            : `يُسجَّل المتقدم تسجيلاً مقبولاً في ${iso(title)}. إن كان له تسجيل سابق قيد المراجعة أو منسحب أو مرفوض يصبح مقبولاً.`,
          `يُعثر على حساب لـ ${iso(email)} أو يُنشأ حساب جديد مع ملف شخصي. يُضاف دور الطالب إن لم يكن موجوداً.`,
          `يُرسل بريد إلى ${iso(email)} يخبره بقبوله في ${iso(title)}، مع زر لتسجيل الدخول.`,
          ...(programme
            ? []
            : [
                'عند قرار كل المقررات تصبح حالة الطلب «مقبول» إن قُبل مقرر واحد على الأقل، وإلا «مرفوض».',
              ]),
          'لا يُبلَّغ أي شخص آخر.',
          'إذا تعذر إرسال البريد يبقى القرار، ويظهر زر لإرساله مرة أخرى.',
        ],
        rejectEffects: (email: string, title: string, programme: boolean) => [
          programme
            ? 'تتغير حالة الطلب إلى «مرفوض» ويُحفظ تاريخ القرار.'
            : `يتغير قرار ${iso(title)} إلى «مرفوض» ويُحفظ تاريخه.`,
          programme
            ? 'لا يُنشأ حساب ولا عضوية.'
            : `لا يُنشأ حساب. إن كان للمتقدم تسجيل في ${iso(title)} قيد المراجعة أو مقبول يصبح «مرفوضاً».`,
          `يُرسل بريد مهذب إلى ${iso(email)} يخبره بأن طلبه في ${iso(title)} لم يُقبل.`,
          ...(programme
            ? []
            : [
                'عند قرار كل المقررات تصبح حالة الطلب «مقبول» إن قُبل مقرر واحد على الأقل، وإلا «مرفوض».',
              ]),
          'لا يُبلَّغ أي شخص آخر.',
          'إذا تعذر إرسال البريد يبقى القرار، ويظهر زر لإرساله مرة أخرى.',
        ],
        reopenEffects: (title: string, was: 'accepted' | 'rejected', programme: boolean) => [
          programme
            ? 'تعود حالة الطلب إلى «قيد المراجعة».'
            : `يعود قرار ${iso(title)} إلى «قيد المراجعة».`,
          ...(programme
            ? []
            : [
                `يعود تسجيل المتقدم في ${iso(title)} إلى «قيد المراجعة» بعد أن كان ${was === 'accepted' ? 'مقبولاً' : 'مرفوضاً'}. التسجيل المؤكد لا يتغير، ويظهر لك خطأ.`,
                'تُحسب حالة الطلب من جديد.',
              ]),
          'لا يُرسل أي بريد. إن كان المتقدم قد تلقى بريداً فأخبره بنفسك.',
        ],
        submitted: 'تاريخ التقديم',
        empty: 'لا توجد طلبات بعد',
        emptyBody: 'ستظهر الطلبات المقدمة للمقررات هنا.',
        noMatches: 'لا توجد طلبات مطابقة',
        noMatchesBody: 'امسح التصفيات لرؤية كل الطلبات.',
        loading: 'جارٍ تحميل الطلبات',
        showing: (shown: number, total: number) => `عرض ${shown} من ${total} طلب`,
        loadError: 'تعذر تحميل الطلبات',
        retry: 'إعادة المحاولة',
        failed: 'تعذر حفظ القرار. حاول مرة أخرى.',
        emailFailed:
          'تم حفظ القرار، لكن تعذر إرسال البريد. أرسله مرة أخرى من الطلب، أو تواصل مع المتقدم.',
        untitled: 'متقدم بدون اسم',
        noCover: 'لا توجد صورة للمقرر',
        list: 'قائمة الطلبات',
      }
    : {
        title: 'Applicants',
        course: 'Course',
        cycle: 'Cycle',
        status: 'Status',
        reduction: 'Reduction requested',
        yes: 'Yes',
        no: 'No',
        add: 'Add filter',
        clear: 'Clear filters',
        noFilters: 'No filters applied',
        back: 'Back to fields',
        statuses: { new: 'Pending', accepted: 'Accepted', rejected: 'Rejected' },
        decisions: { pending: 'Pending', accepted: 'Accepted', rejected: 'Rejected' },
        review: 'Review',
        accept: 'Accept',
        reject: 'Reject',
        reopen: 'Reopen',
        resend: 'Send email again',
        accepting: 'Accepting',
        rejecting: 'Rejecting',
        reopening: 'Reopening',
        resending: 'Sending',
        reopened: 'Reopened',
        emailNotSent: 'Email not sent',
        cancel: 'Cancel',
        close: 'Close',
        acceptTitle: (title: string) => `Accept for ${title}?`,
        acceptBody: (name: string, title: string) =>
          `Accept the application from ${name} for ${title}.`,
        rejectTitle: (title: string) => `Reject for ${title}?`,
        rejectBody: (name: string, title: string) =>
          `Reject the application from ${name} for ${title}.`,
        reopenTitle: (title: string) => `Reopen the decision for ${title}?`,
        reopenBody: (name: string, title: string) =>
          `Put the application from ${name} for ${title} back to Pending.`,
        whatNext: 'What happens next',
        acceptEffects: (email: string, title: string, programme: boolean) => [
          programme
            ? 'The status changes to Accepted. The decision date is saved.'
            : `The decision for ${title} changes to Accepted. The decision date is saved.`,
          programme
            ? `A membership in ${title} is created for the applicant.`
            : `The applicant gets an accepted enrollment in ${title}. An earlier enrollment that was waiting, withdrawn or rejected becomes accepted.`,
          `An account for ${email} is found or created, with a person profile. The student role is added if the account does not have it.`,
          `An email goes to ${email}. It says they are accepted to ${title} and has a sign-in button.`,
          ...(programme
            ? []
            : [
                'When every course has a decision, the application is Accepted if any course is accepted. If not, it is Rejected.',
              ]),
          'No one else is notified.',
          'If the email fails, the decision stays and you can send the email again.',
        ],
        rejectEffects: (email: string, title: string, programme: boolean) => [
          programme
            ? 'The status changes to Rejected. The decision date is saved.'
            : `The decision for ${title} changes to Rejected. The decision date is saved.`,
          programme
            ? 'No account or membership is created.'
            : `No account is created. An enrollment in ${title} that is waiting or accepted becomes Rejected.`,
          `A kind email goes to ${email}. It says their application to ${title} was not accepted.`,
          ...(programme
            ? []
            : [
                'When every course has a decision, the application is Accepted if any course is accepted. If not, it is Rejected.',
              ]),
          'No one else is notified.',
          'If the email fails, the decision stays and you can send the email again.',
        ],
        reopenEffects: (title: string, was: 'accepted' | 'rejected', programme: boolean) => [
          programme
            ? 'The status goes back to Pending.'
            : `The decision for ${title} goes back to Pending.`,
          ...(programme
            ? []
            : [
                `The applicant's enrollment in ${title} goes back to Applied, from ${was === 'accepted' ? 'Accepted' : 'Rejected'}. A confirmed enrollment is never changed, and you see an error.`,
                'The application status is worked out again.',
              ]),
          'No email goes out. If the applicant already got one, tell them yourself.',
        ],
        submitted: 'Submitted',
        empty: 'No applications yet',
        emptyBody: 'Applications submitted for courses will appear here.',
        noMatches: 'No matching applications',
        noMatchesBody: 'Clear the filters to see all applications.',
        loading: 'Loading applications',
        showing: (shown: number, total: number) =>
          `Showing ${shown} of ${total} ${total === 1 ? 'application' : 'applications'}`,
        loadError: 'Could not load applications',
        retry: 'Try again',
        failed: 'Could not save the decision. Try again.',
        emailFailed:
          'The decision is saved, but the email did not send. Contact the applicant directly.',
        untitled: 'Unnamed applicant',
        noCover: 'No course cover',
        list: 'Applications',
      }
