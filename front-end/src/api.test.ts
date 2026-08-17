import { afterEach, expect, test, vi } from 'vitest'

import { ApiError, getCategories, getTransactions, uploadStatement } from './api'

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

  expect(fetchMock.mock.calls[0][0]).toBe('/api/transactions')
  expect(transactions).toEqual([
    { id: 1, merchant: 'Loblaws', amount: '42.50' },
  ])
})

test('unwraps the categories out of the response body', async () => {
  const fetchMock = stubFetch({
    json: async () => ({ categories: [{ id: 1, name: 'Groceries' }] }),
  })

  const categories = await getCategories()

  expect(fetchMock.mock.calls[0][0]).toBe('/api/categories')
  expect(categories).toEqual([{ id: 1, name: 'Groceries' }])
})

test('posts the pdf and source as multipart form data', async () => {
  const fetchMock = stubFetch({
    json: async () => ({
      period: 'March 12, 2004 to April 12, 2004',
      transactions: [{ id: 1, merchant: 'Loblaws', amount: '-42.50' }],
      inserted_count: 1,
      skipped_count: 3,
    }),
  })

  const file = new File(['%PDF-1.4'], 'statement.pdf', { type: 'application/pdf' })
  const result = await uploadStatement(file, 'rbc_debit')

  expect(result).toMatchObject({ inserted_count: 1, skipped_count: 3 })

  const [path, init] = fetchMock.mock.calls[0]
  expect(path).toBe('/api/upload')
  expect(init.method).toBe('POST')
  expect(init.body).toBeInstanceOf(FormData)
  expect(init.body.get('source')).toBe('rbc_debit')
  expect(init.body.get('pdf')).toBe(file)
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
