import { beforeEach, expect, test, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { ApiError, uploadStatement } from './api'
import UploadStatement from './UploadStatement'

// mocks the api module rather than fetch
vi.mock('./api', async () => {
  const actual = await vi.importActual<typeof import('./api')>('./api')
  return { ...actual, uploadStatement: vi.fn() }
})

const uploadStatementMock = vi.mocked(uploadStatement)

function pdf(name = 'statement.pdf') {
  return new File(['%PDF-1.4'], name, { type: 'application/pdf' })
}

function uploadResult(overrides: Partial<Awaited<ReturnType<typeof uploadStatement>>>) {
  return {
    period: 'March 12, 2004 to April 12, 2004',
    opening_balance: 4247.14,
    closing_balance: 3664.79,
    transactions: [],
    inserted_count: 0,
    skipped_count: 0,
    ...overrides,
  }
}

beforeEach(() => {
  uploadStatementMock.mockReset()
})

test('uploads the chosen file and source, then reports inserted and skipped counts', async () => {
  uploadStatementMock.mockResolvedValue(
    uploadResult({ inserted_count: 9, skipped_count: 2 }),
  )
  const user = userEvent.setup()
  const file = pdf()

  render(<UploadStatement />)

  await user.upload(screen.getByLabelText(/statement pdf/i), file)
  await user.selectOptions(screen.getByLabelText(/source/i), 'rbc_credit')
  await user.click(screen.getByRole('button', { name: /upload/i }))

  await waitFor(() => {
    expect(uploadStatementMock).toHaveBeenCalledWith(file, 'rbc_credit')
  })

  await waitFor(() => {
    expect(screen.getByRole('status')).toHaveTextContent(
      '9 imported, 2 skipped as duplicates',
    )
  })
})

test('reports when every row was already imported', async () => {
  uploadStatementMock.mockResolvedValue(
    uploadResult({ inserted_count: 0, skipped_count: 11 }),
  )
  const user = userEvent.setup()

  render(<UploadStatement />)

  await user.upload(screen.getByLabelText(/statement pdf/i), pdf())
  await user.click(screen.getByRole('button', { name: /upload/i }))

  await waitFor(() => {
    expect(screen.getByRole('status')).toHaveTextContent(
      '0 imported, 11 skipped as duplicates',
    )
  })
})

test('shows the server error message when the upload fails', async () => {
  uploadStatementMock.mockRejectedValue(new ApiError(500, 'Parser failed'))
  const user = userEvent.setup()

  render(<UploadStatement />)

  await user.upload(screen.getByLabelText(/statement pdf/i), pdf())
  await user.click(screen.getByRole('button', { name: /upload/i }))

  await waitFor(() => {
    expect(screen.getByRole('alert')).toHaveTextContent('Parser failed')
  })
})

test('will not upload until a file is chosen', async () => {
  const user = userEvent.setup()

  render(<UploadStatement />)

  await user.click(screen.getByRole('button', { name: /upload/i }))

  expect(uploadStatementMock).not.toHaveBeenCalled()
})
