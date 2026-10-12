import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { PracticeWordTooltip } from '@/components/practice/PracticeWordTooltip'
import type { SaveState } from '@/components/ui/WordTooltip'

vi.mock('use-intl', () => ({
  useTranslations: () => (key: string) => `common.${key}`,
}))

const saveStates: SaveState[] = ['idle', 'saving', 'saved', 'exists', 'error']

describe('PracticeWordTooltip', () => {
  it.each([null, ''])(
    'renders nothing for an absent selection (%s)',
    (selectedWord) => {
      const tCommon = vi.fn((key: string) => `common.${key}`)
      const { container } = render(
        <PracticeWordTooltip
          selectedWord={selectedWord}
          tooltipPos={{ x: 10, y: 20 }}
          saveState="idle"
          onSave={vi.fn()}
          onDismiss={vi.fn()}
          tCommon={tCommon}
        />
      )
      expect(container).toBeEmptyDOMElement()
      expect(tCommon).not.toHaveBeenCalled()
    }
  )

  it('passes the original word, position, translated labels and callbacks without the click event', () => {
    const onSave = vi.fn()
    const onDismiss = vi.fn()
    const tCommon = vi.fn((key: string) => `common.${key}`)
    const { container } = render(
      <PracticeWordTooltip
        selectedWord="駅"
        tooltipPos={{ x: 10, y: 20 }}
        saveState="idle"
        onSave={onSave}
        onDismiss={onDismiss}
        tCommon={tCommon}
      />
    )
    expect(container.children).toHaveLength(1)
    expect(container.firstElementChild).toHaveAttribute(
      'class',
      'pointer-events-auto fixed z-50 -translate-x-1/2 -translate-y-full'
    )
    expect(container.firstElementChild).toHaveStyle({
      left: '10px',
      top: '20px',
    })
    expect(screen.getByText('駅')).toHaveClass('text-fl-fg', 'font-bold')
    expect(tCommon.mock.calls.map(([key]) => key)).toEqual([
      'saveWord',
      'wordSaved',
      'wordAlreadySaved',
      'wordSaveError',
    ])
    fireEvent.click(screen.getByRole('button', { name: 'common.saveWord' }))
    expect(onSave).toHaveBeenCalledExactlyOnceWith()
    fireEvent.click(screen.getByRole('button', { name: 'common.close' }))
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it.each(saveStates)(
    'preserves WordTooltip rendering for save state %s',
    (saveState) => {
      render(
        <PracticeWordTooltip
          selectedWord="駅"
          tooltipPos={{ x: 0, y: 0 }}
          saveState={saveState}
          onSave={vi.fn()}
          onDismiss={vi.fn()}
          tCommon={(key) => `common.${key}`}
        />
      )
      const labels = {
        idle: 'common.saveWord',
        saving: '...',
        saved: '✓ common.wordSaved',
        exists: '✓ common.wordAlreadySaved',
        error: 'common.wordSaveError',
      }
      expect(screen.getByText(labels[saveState])).toBeInTheDocument()
      expect(
        screen.getByRole('button', { name: 'common.close' })
      ).toBeInTheDocument()
      if (saveState !== 'idle') {
        expect(
          screen.queryByRole('button', { name: 'common.saveWord' })
        ).not.toBeInTheDocument()
      }
    }
  )
})
