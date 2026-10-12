/**
 * A course flow's notes often end with its fellows' bios ("Bio: …",
 * "Instructor bio (verbatim): …", "المدربة: …"). Bios belong on the fellow's
 * profile, not the course, so this splits them from the notes the course
 * keeps, and says whose each one is when it can tell.
 */

export type FlowBio = { text: string; name: string | null }

const paragraphs = (text: string): string[] =>
  text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)

/** "Bio", "Personal bio (verbatim)", "Instructor’s Biography", "Bio (Sarah Maher)", then ":" or "|". */
const BIO_LABEL =
  /^(?:(?:personal|instructor(?:['’]s)?|facilitator(?:['’]s)?|fellow(?:['’]s)?)\s+)?bio(?:graphy)?\b\s*(?:\(([^)]*)\))?\s*(?:\(verbatim\))?\s*[:|\n]?\s*/i

/** A role that opens a bio: "FELLOW: Nabil …", "المدربة: سارة …", or the Arabic "السيرة" heading. */
const ROLE_LABEL = /^(?:fellow|facilitator|instructor|المدر\u0651س|المدرس|المدر\u0651سة|المدرسة|المدربة|المدرب|الميسرة|الميسر|السيرة)\s*[:：|\n]\s*/i
const ROLE_HEADING = /^(?:السيرة|السيرة الذاتية|نبذة)\s*:?$/

/** "تيسر المعمل مي عامر …", "تقدم المساق مي عامر …": the rest is the bio. */
const ARABIC_INTRO = /^(?:تيسر|تيس\u0651ر|يقدم|تقدم|تقد\u0651م|يدير|تدير)\s+(?:المعمل|المساق|الورشة|المقرر)\s+/

/** A course's own description, which a role label can also open ("Instructor: X. Course description: …"). */
const NOT_BIO = /course (?:description|overview|flow)|description\s*:/i

/**
 * The extractor's own remarks about the source ("The flow has no unit
 * numbers…", "Instructor (from the flow header): …"): not the course's text.
 */
const EXTRACTOR_REMARK =
  /\b(?:the|this) flow\b|\bflow['’]s\b|\bflow header\b|\bwere not recorded\b|\brecorded as\b/i

/** "Course description (verbatim):", "Course Flow, verbatim:" → "Course description:", "Course Flow:". */
const unannotate = (p: string): string =>
  p
    .replace(/\s*\((?:verbatim|as given|as written)[^)]*\)\s*:/gi, ':')
    .replace(/,\s*verbatim\s*:/gi, ':')
    .replace(/\s*\(verbatim[^)]*\)/gi, '')

/** Words a bio uses that a course note does not. */
const BIO_CUE =
  /\b(?:holds|graduated|ph\.?d|m\.?a\.?|b\.?a\.?|degree|is a|is an|studied|researcher|lecturer|writer|translator|author)\b|حاصل|حصل|باحث|مترجم|كاتب|تخرج/i

const fold = (s: string): string =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f\u064b-\u065f\u0670]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()

/** The fellow a bio is about: the one named in its label, or in its first words, or the only one. */
const whose = (text: string, label: string | null, fellows: string[][]): string | null => {
  const named = (s: string) =>
    fellows.find((names) => names.some((n) => fold(n) && fold(s).includes(fold(n))))?.[0] ?? null
  return (label && named(label)) || named(text.slice(0, 80)) || (fellows.length === 1 ? fellows[0][0] : null)
}

/**
 * Splits a flow's notes into what the course keeps and its fellows' bios,
 * dropping the extractor's remarks and its "(verbatim)" annotations.
 * `fellows` lists each fellow's names (every spelling it has); a bio is
 * given the first name of the fellow it matches.
 */
export const splitBios = (
  notes: string | null | undefined,
  fellows: string[][],
): { notes: string | null; bios: FlowBio[] } => {
  const paras = paragraphs(notes ?? '')
    .map(unannotate)
    .filter((p) => !EXTRACTOR_REMARK.test(p))
  const kept: string[] = []
  const bios: FlowBio[] = []
  const startsWithFellow = (p: string) =>
    fellows.some((names) => names.some((n) => fold(n) && fold(p).startsWith(fold(n))))

  for (let i = 0; i < paras.length; i++) {
    const p = paras[i]
    const bio = p.match(BIO_LABEL)
    const role = p.match(ROLE_LABEL)
    const intro = p.match(ARABIC_INTRO)
    let text: string | null = null
    let label: string | null = null

    if (bio) {
      label = bio[1] && !/verbatim/i.test(bio[1]) ? bio[1] : null
      text = p.slice(bio[0].length).trim()
    } else if (ROLE_HEADING.test(p)) {
      text = ''
    } else if (role) {
      text = p.slice(role[0].length).trim()
    } else if (intro) {
      text = p.slice(intro[0].length).trim()
    } else if (startsWithFellow(p) && BIO_CUE.test(p)) {
      text = p
    }

    // A label on its own: the bio is the next paragraph.
    if (text === '' && i + 1 < paras.length) text = paras[++i]
    // Too short to be a bio ("Facilitator: Ahmed Dardir"): a note after all.
    if (text === null || text.length < 60 || NOT_BIO.test(text)) {
      kept.push(p)
      continue
    }
    bios.push({ text, name: whose(text, label, fellows) })
  }

  return { notes: kept.length ? kept.join('\n\n') : null, bios }
}
