import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EventCarousel } from '@/components/events/event-carousel'
import { Carousel } from '@/components/arc/carousel/carousel'
import messages from '../../messages/en.json'

vi.mock('motion/react', async (original) => ({
  ...(await original<typeof import('motion/react')>()),
  useReducedMotion: () => true,
}))
beforeEach(() =>
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    },
  ),
)
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})
const slides = (count: number) =>
  Array.from({ length: count }, (_, index) => <div key={index}>Event {index + 1}</div>)

describe('event carousel navigation', () => {
  it('animates individual cards with the original centered scale and fade', () => {
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <EventCarousel label="Upcoming events">{slides(3)}</EventCarousel>
      </NextIntlClientProvider>,
    )
    const cards = document.querySelectorAll('[aria-roledescription="slide"]')
    expect(cards).toHaveLength(3)
    expect(cards[0]).toHaveStyle({ opacity: '0.5', transform: 'scale(0.9)' })
    expect(cards[1]).toHaveStyle({ opacity: '1' })
    expect(cards[1]).not.toHaveAttribute('inert')
    expect(cards[2]).toHaveStyle({ opacity: '0.5', transform: 'scale(0.9)' })
    expect(screen.getByRole('tab', { name: '2 of 3' })).toHaveAttribute('aria-selected', 'true')
  })
  it('uses a compact counter for many events and keeps arrow and keyboard navigation', () => {
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <EventCarousel label="Upcoming events">{slides(80)}</EventCarousel>
      </NextIntlClientProvider>,
    )
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument()
    expect(screen.getByText('2 of 80', { selector: 'span:not([aria-live])' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(screen.getByText('3 of 80', { selector: 'span:not([aria-live])' })).toBeInTheDocument()
    fireEvent.keyDown(screen.getByRole('region', { name: 'Upcoming events' }), { key: 'End' })
    expect(screen.getByText('80 of 80', { selector: 'span:not([aria-live])' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Next' })).toHaveAttribute('aria-disabled', 'true')
    fireEvent.keyDown(screen.getByRole('region', { name: 'Upcoming events' }), { key: 'Home' })
    expect(screen.getByText('1 of 80', { selector: 'span:not([aria-live])' })).toBeInTheDocument()
  })
  it('keeps direct slide selection for a short event list', () => {
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <EventCarousel label="Upcoming events">{slides(3)}</EventCarousel>
      </NextIntlClientProvider>,
    )
    expect(screen.getAllByRole('tab')).toHaveLength(3)
    fireEvent.click(screen.getByRole('tab', { name: '3 of 3' }))
    expect(screen.getByRole('tab', { name: '3 of 3' })).toHaveAttribute('aria-selected', 'true')
  })
  it('preserves dot navigation for other Arc carousel consumers', () => {
    render(<Carousel label="Posters">{slides(10)}</Carousel>)
    expect(screen.getAllByRole('tab')).toHaveLength(10)
  })
})
