import { expect, test } from 'vitest'
import { render, screen } from '@testing-library/react'

import App from './App'

test('renders the upload control', () => {
  render(<App />)

  expect(screen.getByRole('heading', { name: 'Budget Friend' })).toBeInTheDocument()
  expect(screen.getByLabelText(/statement pdf/i)).toBeInTheDocument()
})
