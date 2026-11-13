'use client'

import {
  createChange,
  createSpans,
  definePrimitive,
  stackSpans,
  type ChangeDetails,
  type SpanAction,
  type SpansDraft,
  type SpansMessage,
  type SpansReason,
  type StateOf,
} from '@ui-sdk/core'
import { createParts, usePart, usePrimitive, type PartProps } from '@ui-sdk/react/primitive'
import { createContext, use, type ReactNode } from 'react'

import type { TimedBlock } from './calendar-model'

type WeekSpansOptions = {
  spans: TimedBlock[]
  onSpansChange?: (
    spans: TimedBlock[],
    details: ChangeDetails<SpansReason> & { id: string; action: SpanAction },
  ) => void
  editable: boolean
  tracks: string[]
  min: number
  max: number
  step: number
  /** Makes the block a press on an empty stretch of a day starts to draw, or null for none. */
  create?: (span: { track: string; start: number; end: number }) => TimedBlock | null
  label: (block: TimedBlock) => string
  message: (message: SpansMessage<TimedBlock>) => string
  /** A block was pressed: a click, or Enter or Space on it. */
  onPress: (block: TimedBlock, event: Event | undefined) => void
}

type WeekSpansState = { spans: TimedBlock[]; draft: SpansDraft<TimedBlock> | null }

const weekSpans = definePrimitive({
  name: 'week-spans',
  options: {
    spans: 'value',
    onSpansChange: 'callback',
    editable: 'boolean',
    tracks: 'list',
    min: 'number',
    max: 'number',
    step: 'number',
    create: 'callback',
    label: 'callback',
    message: 'callback',
    onPress: 'callback',
  },
  controlled: ['spans'],
  state: (options: WeekSpansOptions): WeekSpansState => ({ spans: options.spans, draft: null }),
  sync: (options) => ({ spans: options.spans }),
  api: (context) => {
    const change = createChange(context)
    const options = () => context.options() as WeekSpansOptions
    const spans = createSpans<WeekSpansState, TimedBlock>(context, {
      key: 'spans',
      draft: 'draft',
      set: (value, details) => change('spans', value, details),
      axis: 'y',
      min: () => options().min,
      max: () => options().max,
      step: () => options().step,
      minSize: () => options().step * 2,
      tracks: () => options().tracks,
      disabled: (span) => !options().editable || Boolean(span.deleted),
      create: (span) => options().create?.(span) ?? null,
      label: (block) => options().label(block),
      message: (message) => options().message(message),
      createAutoScroll: false,
    })
    return {
      spans,
      press: (id: string, event?: Event) => {
        const block = context.store.get().spans.find((candidate) => candidate.id === id)
        if (block) options().onPress(block, event)
      },
    }
  },
  slots: (slot) => ({
    root: slot({}),
    track: slot<{ value: string }>({
      props: { value: 'string' },
      bind: (el, { api, key }) => api.spans.bindTrack(el, key),
      on: {
        pointerdown: (event, { api, key }) => api.spans.trackPointerdown(event, key),
      },
    }),
    span: slot<{ value: string }>({
      props: { value: 'string' },
      focus: 'tab-stop',
      attrs: (state, { api, key }) => {
        const block = api.spans.spans(state).find((candidate) => candidate.id === key)
        const lanes = block ? stackSpans(api.spans.spansOn(state, block.track)) : undefined
        return {
          ...api.spans.spanAttrs(state, key),
          type: 'button',
          style: block ? api.spans.spanStyle(block, lanes?.get(key)) : undefined,
        }
      },
      press: ({ api, key }, event) => api.press(key, event),
      bind: (el, { api, key }) => api.spans.bindSpan(el, key),
      on: {
        pointerdown: (event, { api, key }) => api.spans.spanPointerdown(event, key),
        keydown: (event, { api, key }) => {
          api.spans.keydown(event, key)
        },
      },
    }),
  }),
})

type Api = ReturnType<typeof usePrimitive<typeof weekSpans>>['api']

const ApiContext = createContext<Api | null>(null)

/** The span editor's api, for what lives beside the grid, like the tray that drops onto it. */
export function useWeekSpansApi(): Api {
  const api = use(ApiContext)
  if (!api) throw new Error('useWeekSpansApi needs a WeekSpans.Root above it')
  return api
}

type RootProps = WeekSpansOptions &
  Omit<PartProps<'div', StateOf<typeof weekSpans, 'root'>>, keyof WeekSpansOptions> & {
    children?: ReactNode
  }

function Root({
  spans,
  onSpansChange,
  editable,
  tracks,
  min,
  max,
  step,
  create,
  label,
  message,
  onPress,
  ...props
}: RootProps) {
  const handle = usePrimitive(weekSpans, {
    spans,
    onSpansChange,
    editable,
    tracks,
    min,
    max,
    step,
    create,
    label,
    message,
    onPress,
  })
  return <ApiContext value={handle.api}>{usePart(handle, 'root', {}, props, 'div')}</ApiContext>
}

const parts = createParts(weekSpans, { root: 'div', track: 'div', span: 'button' })

export const WeekSpans = { Root, Track: parts.Track, Span: parts.Span }
export { weekSpans }
export type { WeekSpansOptions }
