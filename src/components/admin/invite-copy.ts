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
      }
    : {
        title: 'Invite someone',
        intro: (days: number) =>
          `We make the account and send an email with a link to set a password. The link works for ${days} days.`,
        email: 'Email',
        name: 'Name',
        nameHint: 'Used in the email and on their hidden profile.',
        roles: 'Roles',
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
      }
