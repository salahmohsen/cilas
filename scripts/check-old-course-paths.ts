/**
 * The "Done means" check of the plan "Move course readers to the sessions
 * collection" (docs/plans/2026-11-13-sessions-readers.md), item 1. Reads only.
 *
 *   pnpm tsx scripts/check-old-course-paths.ts
 *
 * Fails (exit 1) and lists each hit when code in `src/`:
 * - imports `expandSchedule`, `sessionsInOrder`, `scheduleEndDate`,
 *   `nextSession`, `isOnCalendar` or `hasDayPrecision` from `lib/schedule.ts`,
 *   outside the event code in `EVENT_IMPORTS`;
 * - reads or writes the course's old `schedule` group or `sessions` array:
 *   a property access, element access, destructuring, object literal property
 *   or indexed type whose property the type checker resolves to `schedule` or
 *   `sessions` of the generated `Course` or `CoursesSelect` interface. A
 *   course loaded with its sessions from the collection
 *   (`Omit<Course, 'sessions'> & { sessions: Session[] }`) declares its own
 *   `sessions`, so it does not count.
 *
 * Also lists, for the record, the scripts that still import those functions
 * (the migration's fill and verify scripts read the old fields).
 */
import { relative, resolve } from 'node:path'
import ts from 'typescript'

const ROOT = resolve(import.meta.dirname, '..')
const SCHEDULE = resolve(ROOT, 'src/lib/schedule.ts')
const TYPES = resolve(ROOT, 'src/payload-types.ts')
const NAMES = new Set([
  'expandSchedule',
  'sessionsInOrder',
  'scheduleEndDate',
  'nextSession',
  'isOnCalendar',
  'hasDayPrecision',
])
const FIELDS = new Set(['schedule', 'sessions'])
const COURSE_TYPES = new Set(['Course', 'CoursesSelect'])

/** Events keep their pattern until their own phase (ADR 0011). */
const EVENT_IMPORTS: Record<string, string[]> = {
  'src/components/events/event-page.tsx': ['expandSchedule', 'isOnCalendar'],
  'src/fields/schedule.ts': ['expandSchedule'],
  'src/lib/event-calendar.ts': ['expandSchedule', 'hasDayPrecision'],
  'src/lib/event-schema.ts': ['expandSchedule', 'hasDayPrecision'],
  'src/lib/events.ts': ['expandSchedule', 'hasDayPrecision'],
  'src/lib/spaces-data.ts': ['expandSchedule'],
}

const parsed = ts.parseJsonConfigFileContent(
  ts.readConfigFile(resolve(ROOT, 'tsconfig.json'), ts.sys.readFile).config,
  ts.sys,
  ROOT,
)
const program = ts.createProgram({
  rootNames: parsed.fileNames.filter((f) => /\/(src|scripts)\//.test(f)),
  options: { ...parsed.options, incremental: false, noEmit: true },
})
const checker = program.getTypeChecker()

const where = (node: ts.Node): string => {
  const file = node.getSourceFile()
  const { line } = file.getLineAndCharacterOfPosition(node.getStart())
  return `${relative(ROOT, file.fileName)}:${line + 1}`
}

/** Is this property symbol `schedule` or `sessions` of the generated course types? */
const isOldCourseField = (symbol: ts.Symbol | undefined): boolean => {
  if (!symbol || !FIELDS.has(symbol.name)) return false
  const seen = new Set<ts.Symbol>()
  const origins = (s: ts.Symbol): ts.Declaration[] => {
    if (seen.has(s)) return []
    seen.add(s)
    // Union and intersection members, and mapped types without declarations.
    const synthetic = (s as { links?: { syntheticOrigin?: ts.Symbol } }).links?.syntheticOrigin
    const target = (s as { links?: { target?: ts.Symbol } }).links?.target
    return [
      ...(s.declarations ?? []),
      ...(synthetic ? origins(synthetic) : []),
      ...(target ? origins(target) : []),
    ]
  }
  return origins(symbol).some((d) => {
    const owner = d.parent
    return (
      d.getSourceFile().fileName === TYPES &&
      ts.isInterfaceDeclaration(owner) &&
      COURSE_TYPES.has(owner.name.text)
    )
  })
}

const propertyOf = (type: ts.Type, name: string): ts.Symbol | undefined =>
  checker.getPropertyOfType(checker.getApparentType(type), name) ??
  (type.isUnion()
    ? type.types.map((t) => checker.getPropertyOfType(t, name)).find(Boolean)
    : undefined)

const byPlace = (a: string, b: string) => a.localeCompare(b, 'en', { numeric: true })
const hits: string[] = []
const scriptImports: string[] = []

for (const file of program.getSourceFiles()) {
  const path = relative(ROOT, file.fileName)
  const inSrc = path.startsWith('src/')
  const inScripts = path.startsWith('scripts/')
  if (!inSrc && !inScripts) continue
  if (file.fileName === SCHEDULE || file.fileName === TYPES || path.startsWith('src/migrations/'))
    continue

  const visit = (node: ts.Node): void => {
    // Imports of the pattern functions.
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const resolved = ts.resolveModuleName(
        node.moduleSpecifier.text,
        file.fileName,
        program.getCompilerOptions(),
        ts.sys,
      ).resolvedModule?.resolvedFileName
      const bindings = node.importClause?.namedBindings
      if (resolved === SCHEDULE && bindings && ts.isNamedImports(bindings)) {
        for (const el of bindings.elements) {
          const name = (el.propertyName ?? el.name).text
          if (!NAMES.has(name)) continue
          if (inScripts) scriptImports.push(`${where(el)} ${name}`)
          else if (!EVENT_IMPORTS[path]?.includes(name))
            hits.push(`${where(el)} imports ${name} from lib/schedule`)
        }
      }
    }

    if (inSrc) {
      // course.schedule, course?.sessions
      if (ts.isPropertyAccessExpression(node) && FIELDS.has(node.name.text)) {
        if (isOldCourseField(checker.getSymbolAtLocation(node.name)))
          hits.push(`${where(node)} reads ${node.getText()}`)
      }
      // course['sessions']
      if (
        ts.isElementAccessExpression(node) &&
        ts.isStringLiteralLike(node.argumentExpression) &&
        FIELDS.has(node.argumentExpression.text)
      ) {
        const prop = propertyOf(
          checker.getTypeAtLocation(node.expression),
          node.argumentExpression.text,
        )
        if (isOldCourseField(prop)) hits.push(`${where(node)} reads ${node.getText()}`)
      }
      // const { schedule } = course
      if (ts.isBindingElement(node) && ts.isObjectBindingPattern(node.parent)) {
        const key = node.propertyName ?? node.name
        if (ts.isIdentifier(key) && FIELDS.has(key.text)) {
          const prop = propertyOf(checker.getTypeAtLocation(node.parent), key.text)
          if (isOldCourseField(prop)) hits.push(`${where(node)} destructures ${key.text}`)
        }
      }
      // { sessions: [...] } as course data or a select
      if (
        (ts.isPropertyAssignment(node) || ts.isShorthandPropertyAssignment(node)) &&
        ts.isIdentifier(node.name) &&
        FIELDS.has(node.name.text) &&
        ts.isObjectLiteralExpression(node.parent)
      ) {
        const contextual = checker.getContextualType(node.parent)
        const prop = contextual && propertyOf(contextual, node.name.text)
        if (isOldCourseField(prop)) hits.push(`${where(node)} writes ${node.name.text}`)
      }
      // Course['sessions'] in a type
      if (
        ts.isIndexedAccessTypeNode(node) &&
        ts.isLiteralTypeNode(node.indexType) &&
        ts.isStringLiteral(node.indexType.literal) &&
        FIELDS.has(node.indexType.literal.text)
      ) {
        const prop = propertyOf(
          checker.getTypeFromTypeNode(node.objectType),
          node.indexType.literal.text,
        )
        if (isOldCourseField(prop)) hits.push(`${where(node)} names ${node.getText()}`)
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(file)
}

console.log('Scripts that still import the pattern functions (the migration record):')
for (const line of scriptImports.sort(byPlace)) console.log(`  ${line}`)
if (hits.length) {
  console.log(`\nFAIL: ${hits.length} course use(s) of the old code paths in src/:`)
  for (const line of hits.sort(byPlace)) console.log(`  ${line}`)
  process.exit(1)
}
console.log('\nPASS: no course code in src/ imports the pattern functions or reads the old fields.')
