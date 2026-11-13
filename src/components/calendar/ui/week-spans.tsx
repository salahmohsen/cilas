'use client'

import {
  createChange,
  createSpans,
  definePrimitive,
  stackSpans,
  type ChangeDetails,
  type SpanAction,
  type SpansDraft,
  type SpansReason,
} from '@ui-sdk/core'
import { createParts } from '@ui-sdk/react/primitive'

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
  create?: (span: { track: string; start: number; end: number }) => TimedBlock | null
  label: (block: TimedBlock) => string
  onOpen: (block: TimedBlock) => void
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
    onOpen: 'callback',
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
      disabled: () => !options().editable,
      create: (span) => options().create?.(span) ?? null,
      label: (block) => options().label(block),
      createAutoScroll: false,
    })
    return {
      spans,
      open: (id: string) => {
        const block = context.store.get().spans.find((candidate) => candidate.id === id)
        if (block) options().onOpen(block)
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
      press: ({ api, key }) => api.open(key),
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

const WeekSpans = createParts(weekSpans, { root: 'div', track: 'div', span: 'button' })

export { WeekSpans, type WeekSpansOptions }
