// the single network boundary for the app — components call through here so
// tests can mock this module instead of the global fetch

const BASE_URL = '/api'

export type Category = {
  id: number
  name: string
  user_id: number | null
}

export type Transaction = {
  id: number
  // postgres DECIMAL comes back as a string, so it stays a string here
  amount: string
  date: string
  merchant: string
  description: string | null
  source: string
  created_at: string
  user_id: number
  category_id: number | null
}

export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

// sends a request and unwraps the json body, throwing ApiError on a bad status
async function request<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`)

  let body: unknown = null
  try {
    body = await res.json()
  } catch {
    body = null
  }

  if (!res.ok) {
    const error =
      body && typeof body === 'object' && 'error' in body
        ? String((body as { error: unknown }).error)
        : res.statusText
    throw new ApiError(res.status, error)
  }

  return body as T
}

export async function getTransactions(): Promise<Transaction[]> {
  const body = await request<{ transactions: Transaction[] }>('/transactions')
  return body.transactions
}

export async function getCategories(): Promise<Category[]> {
  const body = await request<{ categories: Category[] }>('/categories')
  return body.categories
}
