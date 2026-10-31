// Local Oxlint JS plugin. Ported from the former ESLint `no-restricted-syntax`
// selector: Program:has('use client' directive) > ImportDeclaration[source='@/env'].
const rule = {
  meta: {
    type: 'problem',
    docs: { description: 'Client Components must import public settings from @/env.client.' },
    messages: { restricted: 'Client Components must import public settings from @/env.client.' },
    schema: [],
  },
  create(context) {
    let isClient = false
    return {
      Program(program) {
        isClient = program.body.some(
          (node) =>
            node.type === 'ExpressionStatement' &&
            node.expression.type === 'Literal' &&
            node.expression.value === 'use client',
        )
      },
      ImportDeclaration(node) {
        if (isClient && node.source.value === '@/env') {
          context.report({ node, messageId: 'restricted' })
        }
      },
    }
  },
}

const plugin = {
  meta: { name: 'cilas' },
  rules: { 'no-env-in-client-component': rule },
}

export default plugin
