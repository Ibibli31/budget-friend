import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

// registers the dom matchers (toBeInTheDocument, toHaveTextContent, ...)
import '@testing-library/jest-dom/vitest'

// unmounts anything rendered so tests don't leak dom between each other
afterEach(cleanup)
