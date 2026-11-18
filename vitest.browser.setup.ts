import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

import { resetMedia } from './testing/media.test-utils'

afterEach(async () => {
  cleanup()
  await resetMedia()
})
