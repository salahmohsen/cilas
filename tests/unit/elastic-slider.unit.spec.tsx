import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ElasticSlider } from '@/components/arc/elastic-slider/elastic-slider'

describe('ElasticSlider direction', () => {
  it.each(['ltr', 'rtl'] as const)(
    'places the minimum at the reading start and reverses horizontal keys in %s',
    (dir) => {
      const changed = vi.fn()
      render(
        <div dir={dir}>
          <ElasticSlider
            label="Contribution"
            dir={dir}
            defaultValue={1}
            min={0}
            max={2}
            marks={[
              { value: 0, label: '100' },
              { value: 2, label: '900' },
            ]}
            onValueChange={changed}
          />
        </div>,
      )
      const minimum = screen.getByText('100')
      expect(minimum.style.left).toBe(dir === 'rtl' ? '100%' : '0%')
      fireEvent.keyDown(screen.getByRole('slider'), { key: 'ArrowLeft' })
      expect(changed).toHaveBeenLastCalledWith(dir === 'rtl' ? 2 : 0)
      fireEvent.keyDown(screen.getByRole('slider'), { key: 'Home' })
      expect(screen.getByRole('slider')).toHaveAttribute('aria-valuenow', '0')
      fireEvent.keyDown(screen.getByRole('slider'), { key: 'ArrowUp' })
      expect(screen.getByRole('slider')).toHaveAttribute('aria-valuenow', '1')
    },
  )
})
