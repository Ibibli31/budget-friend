import { afterEach, expect, test, vi } from 'vitest'

import { ApiError, getCategories, getTransactions } from './api'

// stubs the global fetch so these tests never touch a real server
function stubFetch(response: Partial<Response>) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    statusText: 'OK',
    json: async () => ({}),
    ...response,
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

afterEach(() => {
  vi.unstubAllGlobals()
})

test('unwraps the transactions out of the response body', async () => {
  const fetchMock = stubFetch({
    json: async () => ({
      transactions: [{ id: 1, merchant: 'Loblaws', amount: '42.50' }],
    }),
  })

  const transactions = await getTransactions()

  expect(fetchMock).toHaveBeenCalledWith('/api/transactions')
  expect(transactions).toEqual([
    { id: 1, merchant: 'Loblaws', amount: '42.50' },
  ])
})

test('unwraps the categories out of the response body', async () => {
  const fetchMock = stubFetch({
    json: async () => ({ categories: [{ id: 1, name: 'Groceries' }] }),
  })

  const categories = await getCategories()

  expect(fetchMock).toHaveBeenCalledWith('/api/categories')
  expect(categories).toEqual([{ id: 1, name: 'Groceries' }])
})

test('raises the api error message the server sent back', async () => {
  stubFetch({
    ok: false,
    status: 500,
    json: async () => ({ error: 'Failed to fetch transactions' }),
  })

  const failure = await getTransactions().catch((err: unknown) => err)

  expect(failure).toBeInstanceOf(ApiError)
  expect(failure).toMatchObject({
    status: 500,
    message: 'Failed to fetch transactions',
  })
})

test('falls back to the status text when the error body is not json', async () => {
  stubFetch({
    ok: false,
    status: 502,
    statusText: 'Bad Gateway',
    json: async () => {
      throw new SyntaxError('Unexpected token < in JSON')
    },
  })

  const failure = await getCategories().catch((err: unknown) => err)

  expect(failure).toMatchObject({ status: 502, message: 'Bad Gateway' })
})
