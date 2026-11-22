import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { ListSearch } from './list-search'

const renderSearch = (props: { q?: string | null; show?: 'needsYou' | null } = {}) =>
  render(
    <ListSearch
      q={props.q ?? null}
      show={props.show ?? null}
      action="/en/spaces/articles"
      label="Search"
      clearLabel="Clear search"
    />,
  )

afterEach(cleanup)

describe('ListSearch', () => {
  it('the search is a GET form to the list path', () => {
    renderSearch({ q: 'notes' })
    const form = screen.getByRole('search')
    expect(form.getAttribute('method')).toBe('get')
    expect(form.getAttribute('action')).toBe('/en/spaces/articles')
    const inputs = form.querySelectorAll('input[name="q"]')
    expect(inputs).toHaveLength(1)
    expect((inputs[0] as HTMLInputElement).value).toBe('notes')
    expect(screen.getByRole('searchbox', { name: 'Search' })).toBe(inputs[0])
  })

  it('a set filter adds a hidden show input', () => {
    renderSearch({ show: 'needsYou' })
    const hidden = screen.getByRole('search').querySelectorAll('input[type="hidden"][name="show"]')
    expect(hidden).toHaveLength(1)
    expect((hidden[0] as HTMLInputElement).value).toBe('needsYou')
  })

  it('with no filter there is no hidden input', () => {
    renderSearch()
    expect(screen.getByRole('search').querySelectorAll('input[type="hidden"]')).toHaveLength(0)
  })

  it('a click on the field around the input, the icon or the padding, focuses the input', () => {
    renderSearch()
    const box = screen.getByRole('searchbox', { name: 'Search' })
    const shell = box.parentElement!
    expect(document.activeElement).not.toBe(box)
    fireEvent.click(shell)
    expect(document.activeElement).toBe(box)
  })

  it('typing changes the value', () => {
    renderSearch()
    const box = screen.getByRole('searchbox', { name: 'Search' })
    fireEvent.change(box, { target: { value: 'new text' } })
    expect((box as HTMLInputElement).value).toBe('new text')
  })
})
