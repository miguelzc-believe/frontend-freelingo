import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  fetchMemories: vi.fn(),
  createMemory: vi.fn(),
  deleteMemory: vi.fn(),
  clearMemories: vi.fn(),
}))

vi.mock('use-intl', () => ({
  useTranslations:
    () => (key: string, values?: Record<string, string | number>) =>
      values?.content ? `${key}: ${values.content}` : key,
}))
vi.mock('@/components/ui/app-link', () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode
    href: string
  }) => <a href={href}>{children}</a>,
}))
vi.mock('@/lib/memories', async () => {
  const actual =
    await vi.importActual<typeof import('@/lib/memories')>('@/lib/memories')
  return { ...actual, ...mocks }
})

import SettingsMemoriesPage from '@/app/(app)/settings/memories/page'
import { MemoryApiError } from '@/lib/memories'

const memory = {
  id: 1,
  content: 'Likes hiking',
  source: 'chat',
  created_at: '2026-08-02T10:00:00',
}

describe('memory settings page', () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset())
    mocks.fetchMemories.mockResolvedValue({ memories: [memory] })
  })

  it('loads memories with accessible deletion controls', async () => {
    render(<SettingsMemoriesPage />)
    expect(await screen.findByText('Likes hiking')).toBeInTheDocument()
    expect(
      screen.getByRole('button', {
        name: 'memoryDeleteLabel: Likes hiking',
      })
    ).toBeInTheDocument()
  })

  it('shows a retry state instead of an empty state after load failure', async () => {
    mocks.fetchMemories.mockRejectedValueOnce(new Error('offline'))
    render(<SettingsMemoriesPage />)
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'memoryLoadError'
    )
    expect(screen.queryByText('memoryEmpty')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'memoryAdd' })).toBeDisabled()
  })

  it('adds a manual memory after server confirmation', async () => {
    mocks.createMemory.mockResolvedValueOnce({
      ...memory,
      id: 2,
      content: 'Prefers examples',
      source: 'manual',
    })
    render(<SettingsMemoriesPage />)
    await screen.findByText('Likes hiking')
    fireEvent.change(screen.getByLabelText('memoryInputLabel'), {
      target: { value: '  Prefers examples  ' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'memoryAdd' }))
    await waitFor(() =>
      expect(mocks.createMemory).toHaveBeenCalledWith('Prefers examples')
    )
    expect(await screen.findByText('Prefers examples')).toBeInTheDocument()
    const status = screen.getByRole('status')
    expect(status.tagName).toBe('OUTPUT')
    expect(status).not.toHaveAttribute('role')
    expect(status).toHaveTextContent('memoryAddSuccess')
  })

  it('keeps a memory visible when deletion fails', async () => {
    mocks.deleteMemory.mockRejectedValueOnce(new Error('failed'))
    render(<SettingsMemoriesPage />)
    fireEvent.click(
      await screen.findByRole('button', {
        name: 'memoryDeleteLabel: Likes hiking',
      })
    )
    expect(await screen.findByText('memoryDeleteError')).toBeInTheDocument()
    expect(screen.getByRole('alert').tagName).toBe('OUTPUT')
    expect(screen.getByRole('alert')).toHaveTextContent('memoryDeleteError')
    expect(screen.getByText('Likes hiking')).toBeInTheDocument()
  })

  it('clears the list only after server confirmation', async () => {
    mocks.clearMemories.mockResolvedValueOnce({ deleted: 1 })
    render(<SettingsMemoriesPage />)
    await screen.findByText('Likes hiking')
    fireEvent.click(screen.getByRole('button', { name: 'memoryClearAll' }))
    fireEvent.click(
      screen.getByRole('button', { name: 'memoryClearAllConfirm' })
    )
    expect(await screen.findByText('memoryEmpty')).toBeInTheDocument()
    expect(screen.queryByText('Likes hiking')).not.toBeInTheDocument()
  })

  it('retries a failed load and displays source labels, including unknown sources', async () => {
    mocks.fetchMemories.mockRejectedValueOnce(new Error('offline'))
    mocks.fetchMemories.mockResolvedValueOnce({
      memories: [
        memory,
        { ...memory, id: 2, content: 'Voice memory', source: 'voice' },
        { ...memory, id: 3, content: 'Legacy memory', source: 'unknown' },
      ],
    })
    render(<SettingsMemoriesPage />)
    expect(await screen.findByText('memoryLoadError')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'retry' }))
    expect(await screen.findByText('Likes hiking')).toBeInTheDocument()
    expect(screen.getByText('memorySourceChat')).toBeInTheDocument()
    expect(screen.getByText('memorySourceVoice')).toBeInTheDocument()
    expect(screen.getByText('memorySourceUnknown')).toBeInTheDocument()
  })

  it.each([
    [new MemoryApiError(409), 'memoryDuplicateError'],
    [new Error('offline'), 'memoryAddError'],
  ])(
    'reports add failure without discarding the input',
    async (error, message) => {
      mocks.createMemory.mockRejectedValueOnce(error)
      render(<SettingsMemoriesPage />)
      await screen.findByText('Likes hiking')
      const input = screen.getByLabelText('memoryInputLabel')
      fireEvent.change(input, { target: { value: 'My memory' } })
      fireEvent.click(screen.getByRole('button', { name: 'memoryAdd' }))
      expect(await screen.findByRole('alert')).toHaveTextContent(message)
      expect(input).toHaveValue('My memory')
      expect(screen.getByText('Likes hiking')).toBeInTheDocument()
    }
  )

  it('removes an individual memory after the server confirms deletion', async () => {
    mocks.deleteMemory.mockResolvedValueOnce(undefined)
    render(<SettingsMemoriesPage />)
    fireEvent.click(
      await screen.findByRole('button', {
        name: 'memoryDeleteLabel: Likes hiking',
      })
    )
    expect(await screen.findByText('memoryDeleteSuccess')).toBeInTheDocument()
    expect(screen.getByText('memoryEmpty')).toBeInTheDocument()
    expect(mocks.deleteMemory).toHaveBeenCalledWith(1)
  })

  it('allows retrying clear after an error and cancelling the confirmation', async () => {
    mocks.clearMemories.mockRejectedValueOnce(new Error('offline'))
    render(<SettingsMemoriesPage />)
    await screen.findByText('Likes hiking')
    fireEvent.click(screen.getByRole('button', { name: 'memoryClearAll' }))
    fireEvent.click(
      screen.getByRole('button', { name: 'memoryClearAllConfirm' })
    )
    expect(await screen.findByText('memoryClearError')).toBeInTheDocument()
    expect(screen.getByText('Likes hiking')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'cancel' }))
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'memoryClearAll' }))
    expect(screen.queryByText('memoryClearError')).not.toBeInTheDocument()
  })
})
