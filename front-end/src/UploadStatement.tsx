import { useId, useState, type FormEvent } from 'react'

import { uploadStatement, type UploadResult } from './api'

// selectable statement sources
const SOURCES = [
  { value: 'rbc_debit', label: 'RBC debit' },
  { value: 'rbc_credit', label: 'RBC credit' },
]

type Props = {
  onUploaded?: () => void
}

function UploadStatement({ onUploaded }: Props) {
  const fileInputId = useId()
  const sourceInputId = useId()

  const [file, setFile] = useState<File | null>(null)
  const [source, setSource] = useState(SOURCES[0].value)
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState<UploadResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!file || uploading) return

    // clears the previous outcome
    setResult(null)
    setError(null)
    setUploading(true)

    try {
      setResult(await uploadStatement(file, source))
      onUploaded?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div>
        <label htmlFor={fileInputId}>Statement PDF</label>
        <input
          id={fileInputId}
          type="file"
          accept="application/pdf"
          onChange={event => setFile(event.target.files?.[0] ?? null)}
        />
      </div>

      <div>
        <label htmlFor={sourceInputId}>Source</label>
        <select
          id={sourceInputId}
          value={source}
          onChange={event => setSource(event.target.value)}
        >
          {SOURCES.map(({ value, label }) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <button type="submit" disabled={!file || uploading}>
        {uploading ? 'Uploading…' : 'Upload'}
      </button>

      {/* always-mounted live regions for the upload outcome */}
      <p role="status">
        {result &&
          `${result.inserted_count} imported, ${result.skipped_count} skipped as duplicates`}
      </p>

      <p role="alert">{error}</p>
    </form>
  )
}

export default UploadStatement
