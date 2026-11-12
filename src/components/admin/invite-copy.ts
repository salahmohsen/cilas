import { isolate } from '@/lib/bidi'

/** The text of Admin → Invite someone, and of the buttons that lead to it. */
export const inviteCopy = (ar: boolean) =>
  ar
    ? {
        title: 'دعوة شخص',
        intro: (days: number) =>
          `ننشئ الحساب ونرسل رسالة فيها رابط لاختيار كلمة المرور. يعمل الرابط لمدة ${days} أيام.`,
        email: 'البريد الإلكتروني',
        name: 'الاسم',
        nameHint: 'يظهر في الرسالة وفي ملفه الشخصي المخفي.',
        roles: 'الأدوار',
        roleNames: {
          super_admin: 'مشرف عام',
          admin: 'مشرف',
          fellow: 'زميل',
          member: 'عضو',
          non_degree_seeking: 'طالب غير ساعٍ لدرجة',
        } as Record<string, string>,
        language: 'لغة الرسالة',
        english: 'English',
        arabic: 'العربية',
        submit: 'إرسال الدعوة',
        sending: 'جارٍ الإرسال',
        errors: {
          email: 'اكتب بريدًا إلكترونيًا صحيحًا.',
          name: 'اكتب الاسم.',
          roles: 'اختر دورًا واحدًا على الأقل.',
          exists: 'يوجد حساب بهذا البريد. افتحه لإرسال رابط جديد.',
          failed: 'لم تُرسل الدعوة. حاول مرة أخرى.',
        },
        sentTitle: 'أُرسلت الدعوة',
        sentBody: (email: string) => `أنشأنا الحساب وأرسلنا الرابط إلى ${isolate(email)}.`,
        notSentTitle: 'أُنشئ الحساب، لكن الرسالة لم تُرسل',
        notSentBody: 'افتح الحساب وأرسل رابطًا جديدًا.',
        openAccount: 'فتح الحساب',
        another: 'دعوة شخص آخر',
        send: {
          label: 'رابط كلمة المرور',
          help: (days: number) =>
            `يرسل رابطًا جديدًا لاختيار كلمة المرور. يعمل ${days} أيام ويلغي الروابط السابقة.`,
          button: 'إرسال رابط جديد',
          sending: 'جارٍ الإرسال…',
          language: 'لغة الرسالة',
          failed: 'لم تُرسل الرسالة، والرابط السابق لم يعد يعمل. أرسل رابطًا جديدًا.',
          limit: 'بلغت الدعوات حدها اليومي. أرسل الرابط غدًا.',
          sent: (email: string) => `أُرسلت إلى ${email}.`,
        },
        many: {
          selected: (n: number) => `${n} محدد`,
          language: 'لغة الرسالة',
          again: (days: number) => `وأيضًا من دُعوا خلال آخر ${days} أيام`,
          invite: (n: number) => `دعوة ${n}`,
          confirm: (n: number, lang: string) =>
            `إرسال ${n} دعوة باللغة ${lang}؟ يصل كل شخص رابط لاختيار كلمة المرور. يُتخطى من سجّل الدخول من قبل.`,
          send: 'إرسال',
          cancel: 'إلغاء',
          progress: (done: number, total: number) => `جارٍ إرسال ${done} من ${total}…`,
          sent: (n: number) => `أُرسلت ${n}.`,
          skipped: (n: number) => `تُخطي ${n}: مشرفون، أو سجّلوا الدخول من قبل، أو دُعوا مؤخرًا.`,
          failed: (n: number) => `فشل ${n}، وروابطهم السابقة لم تعد تعمل. ادعهم مرة أخرى.`,
          limited: (n: number) =>
            `لم تُرسل ${n}: بلغت الدعوات حدها اليومي. يبقى جزء من رسائل اليوم لإعادة تعيين كلمات المرور والقرارات. صفِّ حسب «تاريخ الدعوة» وأرسلها غدًا.`,
          error: 'لم تُرسل الدعوات. حاول مرة أخرى.',
          english: 'الإنجليزية',
          arabic: 'العربية',
        },
      }
    : {
        title: 'Invite someone',
        intro: (days: number) =>
          `We make the account and send an email with a link to set a password. The link works for ${days} days.`,
        email: 'Email',
        name: 'Name',
        nameHint: 'Used in the email and on their hidden profile.',
        roles: 'Roles',
        roleNames: {} as Record<string, string>,
        language: 'Email language',
        english: 'English',
        arabic: 'العربية',
        submit: 'Send the invitation',
        sending: 'Sending',
        errors: {
          email: 'Write a valid email address.',
          name: 'Write a name.',
          roles: 'Choose at least one role.',
          exists: 'An account has this email. Open it to send a new link.',
          failed: 'The invitation did not go out. Try again.',
        },
        sentTitle: 'Invitation sent',
        sentBody: (email: string) => `We made the account and sent the link to ${email}.`,
        notSentTitle: 'The account is made, but the email did not go out',
        notSentBody: 'Open the account and send a new link.',
        openAccount: 'Open the account',
        another: 'Invite someone else',
        send: {
          label: 'Set-password link',
          help: (days: number) =>
            `Sends a new link to set the password. It works for ${days} days and replaces older links.`,
          button: 'Send a new link',
          sending: 'Sending…',
          language: 'Email language',
          failed: 'The email did not go out, and the older link no longer works. Send a new link.',
          limit: 'Today’s limit for invitations is reached. Send the link tomorrow.',
          sent: (email: string) => `Sent to ${email}.`,
        },
        many: {
          selected: (n: number) => `${n} selected`,
          language: 'Email language',
          again: (days: number) => `Also people invited in the last ${days} days`,
          invite: (n: number) => `Invite ${n} ${n === 1 ? 'person' : 'people'}`,
          confirm: (n: number, lang: string) =>
            `Send ${n} ${n === 1 ? 'invitation' : 'invitations'} in ${lang}? Each person gets a link to set a password. People who have signed in are skipped.`,
          send: 'Send',
          cancel: 'Cancel',
          progress: (done: number, total: number) => `Sending ${done} of ${total}…`,
          sent: (n: number) => `${n} sent.`,
          skipped: (n: number) =>
            `${n} skipped: admins, people who have signed in, or people invited recently.`,
          failed: (n: number) =>
            `${n} failed, and their older links no longer work. Invite them again.`,
          limited: (n: number) =>
            `${n} not sent: today's limit for invitations is reached. It keeps some of the day's emails for password resets and decisions. Filter by "Invited on" and send them tomorrow.`,
          error: 'The invitations did not go out. Try again.',
          english: 'English',
          arabic: 'Arabic',
        },
      }
