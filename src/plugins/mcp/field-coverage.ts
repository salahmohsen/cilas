import type { Field } from 'payload'
import { flattenFields, excludedField, type DraftCollection } from './field-registry'

export const fieldPaths = (fields: Field[], prefix = ''): string[] =>
  flattenFields(fields).flatMap((field) => {
    if (!('name' in field) || !field.name) return []
    const path = prefix ? `${prefix}.${field.name}` : field.name
    return [
      path,
      ...('fields' in field ? fieldPaths(field.fields, path) : []),
      ...(field.type === 'blocks'
        ? field.blocks.flatMap((block) =>
            typeof block === 'string' ? [] : fieldPaths(block.fields, `${path}.${block.slug}`),
          )
        : []),
    ]
  })
export const uncoveredFields = (
  collection: DraftCollection,
  fields: Field[],
  accepted: readonly string[],
): string[] =>
  fieldPaths(fields).filter((path) => !accepted.includes(path) && !excludedField(collection, path))
