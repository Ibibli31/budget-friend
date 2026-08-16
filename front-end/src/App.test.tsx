import { expect, test } from 'vitest'
import { render, screen } from '@testing-library/react'

import App from './App'

// proves the jsdom + react testing library harness renders real components;
// this gets replaced by real assertions once App is more than the scaffold
test('renders the app', () => {
  render(<App />)

  expect(screen.getByRole('heading', { name: 'Vite + React' })).toBeInTheDocument()
})
