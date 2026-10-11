import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { NativeHelpDisclosure } from '@/components/native-help/NativeHelpDisclosure'
import { NativeHelpGlossary } from '@/components/native-help/NativeHelpGlossary'
import { NativeHelpList } from '@/components/native-help/NativeHelpList'
import { NativeHelpSection } from '@/components/native-help/NativeHelpSection'
import { NativeHelpTraps } from '@/components/native-help/NativeHelpTraps'
import type { NativeHelpGlossaryItem } from '@/components/native-help/types'
import { documentOccurrences } from '@/lib/document-occurrences'

const sectionClass = 'border-fl-border space-y-2 border-t pt-3'
const headingClass =
  'text-fl-label text-fl-muted-3 font-mono tracking-widest uppercase'
const bodyClass = 'text-fl-muted-1 text-sm leading-relaxed'

describe('native help presentation', () => {
  it('omits empty authored sections, including their headings', () => {
    const { container } = render(
      <>
        <NativeHelpList title="Tips" items={[]} />
        <NativeHelpTraps title="Traps" items={[]} />
        <NativeHelpGlossary title="Glossary" languageCode="en-GB" items={[]} />
      </>
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('retains the section heading and border styles with explicit spacing overrides', () => {
    const { rerender } = render(
      <NativeHelpSection title="Traps">
        <p>Authored content</p>
      </NativeHelpSection>
    )
    expect(screen.getByText('Traps')).toHaveAttribute('class', headingClass)
    expect(screen.getByText('Traps').parentElement).toHaveAttribute(
      'class',
      sectionClass
    )
    const content = screen.getByText('Authored content')
    rerender(
      <NativeHelpSection title="Tips" className="space-y-1">
        <p>Authored content</p>
      </NativeHelpSection>
    )
    expect(screen.getByText('Tips').parentElement).toHaveAttribute(
      'class',
      'space-y-1'
    )
    expect(screen.getByText('Authored content')).toBe(content)
  })

  it.each(['space-y-2', 'space-y-1', sectionClass])(
    'renders ordered bullets with %s spacing and stable duplicate occurrences',
    (className) => {
      const path = ['grammar', 'en-GB', 'topic', 'key-points']
      const { rerender } = render(
        <NativeHelpList
          title="Key points"
          className={className}
          items={documentOccurrences(path, [
            'Repeated point',
            'Repeated point',
          ])}
        />
      )
      expect(screen.getByText('Key points').parentElement).toHaveAttribute(
        'class',
        className
      )
      const points = screen.getAllByRole('listitem')
      expect(points).toHaveLength(2)
      expect(points[0]).not.toBe(points[1])
      points.forEach((point) => {
        expect(point).toHaveAttribute(
          'class',
          'text-fl-muted-1 max-w-[70ch] text-sm leading-relaxed'
        )
        expect(point.firstElementChild).toHaveAttribute(
          'class',
          'text-fl-muted-3 mr-2'
        )
        expect(point).toHaveTextContent('·Repeated point')
      })
      expect(screen.getByRole('list')).toHaveAttribute('class', 'space-y-1')
      rerender(
        <NativeHelpList
          title="Key points"
          className={className}
          items={documentOccurrences(path, [
            'New point',
            'Repeated point',
            'Repeated point',
          ])}
        />
      )
      expect(screen.getAllByRole('listitem').slice(1)).toEqual(points)
    }
  )

  it('uses the default list spacing without requiring a class override', () => {
    render(
      <NativeHelpList
        title="Tips"
        items={documentOccurrences(['vocabulary', 'tips'], ['One tip'])}
      />
    )
    expect(screen.getByText('Tips').parentElement).toHaveAttribute(
      'class',
      'space-y-2'
    )
  })

  it('retains trap styles, authored order and duplicate nodes through unrelated insertions', () => {
    const trap = { mistake: 'Repeated mistake', fix: 'Recommended fix' }
    const path = ['phrasebook', 'en-GB', 'greetings', 'common_traps']
    const { rerender } = render(
      <NativeHelpTraps
        title="Common traps"
        items={documentOccurrences(path, [trap, { ...trap }])}
      />
    )
    const mistakes = screen.getAllByText(trap.mistake)
    const fixes = screen.getAllByText(trap.fix)
    expect(mistakes).toHaveLength(2)
    expect(mistakes[0]).not.toBe(mistakes[1])
    expect(screen.getByText('Common traps').parentElement).toHaveAttribute(
      'class',
      sectionClass
    )
    mistakes.forEach((mistake, occurrence) => {
      expect(mistake).toHaveAttribute('class', 'text-fl-muted-2 text-sm')
      expect(mistake.parentElement).toHaveAttribute('class', 'space-y-0.5')
      expect(mistake.nextElementSibling).toBe(fixes[occurrence])
      expect(fixes[occurrence]).toHaveAttribute('class', bodyClass)
    })
    rerender(
      <NativeHelpTraps
        title="Translated traps"
        items={documentOccurrences(path, [
          { mistake: 'Earlier mistake', fix: 'Earlier fix' },
          trap,
          { ...trap },
        ])}
      />
    )
    expect(screen.getAllByText(trap.mistake)).toEqual(mistakes)
    expect(screen.getAllByText(trap.fix)).toEqual(fixes)
  })

  it.each([
    ['en-GB', 'font-target-latin', 'word'],
    ['ja-JP', 'font-target-ja', '言葉'],
    ['ko-KR', 'font-target-ko', '단어'],
    ['zh-CN', 'font-target-zh', '词语'],
  ])(
    'keeps %s terms in TargetLanguageText and native meanings/notes plain',
    (languageCode, fontClass, term) => {
      render(
        <NativeHelpGlossary
          title="Mini glossary"
          languageCode={languageCode}
          items={documentOccurrences(
            ['glossary', languageCode],
            [{ term, meaning: 'Native meaning', note: 'Native note' }]
          )}
        />
      )
      const targetTerm = screen.getByText(term)
      expect(targetTerm.tagName).toBe('SPAN')
      expect(targetTerm).toHaveAttribute('lang', languageCode)
      expect(targetTerm).toHaveClass(
        fontClass,
        'text-fl-muted-1',
        'text-sm',
        'font-bold',
        'tracking-normal',
        'normal-case'
      )
      expect(targetTerm.parentElement).not.toHaveAttribute('class')
      expect(screen.getByText('Mini glossary').parentElement).toHaveAttribute(
        'class',
        sectionClass
      )
      const meaning = screen.getByText('Native meaning')
      const note = screen.getByText('Native note')
      expect(meaning).toHaveAttribute('class', 'text-fl-muted-2 text-sm')
      expect(note).toHaveAttribute('class', bodyClass)
      expect(meaning).not.toHaveAttribute('lang')
      expect(note).not.toHaveAttribute('lang')
    }
  )

  it('omits absent, null and empty glossary notes without collapsing duplicate terms', () => {
    const repeated = { term: 'Repeated term', meaning: 'Repeated meaning' }
    const items: NativeHelpGlossaryItem[] = [
      repeated,
      { ...repeated },
      { term: 'Null note', meaning: 'No note', note: null },
      { term: 'Empty note', meaning: 'No note', note: '' },
      { term: 'Noted term', meaning: 'A meaning', note: 'Authored note' },
    ]
    const path = ['vocabulary', 'en-GB', 'set', 'mini_glossary']
    const { rerender } = render(
      <NativeHelpGlossary
        title="Glossary"
        languageCode="en-GB"
        items={documentOccurrences(path, items)}
      />
    )
    const duplicates = screen.getAllByText(repeated.term)
    expect(duplicates).toHaveLength(2)
    expect(duplicates[0]).not.toBe(duplicates[1])
    items.forEach((item) => {
      const rows = screen.getAllByText(item.term)
      rows.forEach((row) =>
        expect(row.parentElement?.children).toHaveLength(item.note ? 3 : 2)
      )
    })
    rerender(
      <NativeHelpGlossary
        title="Glossary"
        languageCode="en-GB"
        items={documentOccurrences(path, [
          { term: 'Earlier term', meaning: 'Earlier meaning' },
          ...items,
        ])}
      />
    )
    expect(screen.getAllByText(repeated.term)).toEqual(duplicates)
  })
})

describe('NativeHelpDisclosure', () => {
  it.each([
    {
      variant: 'panel' as const,
      wrapper: 'border-fl-border bg-fl-surface border',
      button:
        'border-fl-border text-fl-label text-fl-muted-2 hover:text-fl-fg flex w-full items-center justify-between border-b px-6 py-4 font-mono tracking-widest uppercase transition-colors',
    },
    {
      variant: 'compact' as const,
      wrapper: 'border-fl-border border-b px-5 py-3',
      button:
        'text-fl-label text-fl-muted-3 hover:text-fl-fg flex w-full items-center justify-between font-mono tracking-widest uppercase transition-colors',
    },
  ])(
    'keeps the $variant presentation controlled by the caller',
    ({ variant, wrapper, button: buttonClass }) => {
      const onToggle = vi.fn()
      const { rerender } = render(
        <NativeHelpDisclosure
          title="Help in Spanish"
          open={false}
          onToggle={onToggle}
          variant={variant}
        >
          <p>Screen-owned content</p>
        </NativeHelpDisclosure>
      )
      const button = screen.getByRole('button', { name: 'Help in Spanish+' })
      expect(button).toHaveAttribute('type', 'button')
      expect(button).toHaveAttribute('aria-expanded', 'false')
      expect(button).toHaveAttribute('class', buttonClass)
      expect(button.parentElement).toHaveAttribute('class', wrapper)
      expect(screen.queryByText('Screen-owned content')).toBeNull()
      fireEvent.click(button)
      expect(onToggle).toHaveBeenCalledTimes(1)
      expect(button).toHaveAttribute('aria-expanded', 'false')
      rerender(
        <NativeHelpDisclosure
          title="Help in Spanish"
          open
          onToggle={onToggle}
          variant={variant}
        >
          <p>Screen-owned content</p>
        </NativeHelpDisclosure>
      )
      expect(button).toHaveAttribute('aria-expanded', 'true')
      expect(button).toHaveTextContent('Help in Spanish−')
      const content = screen.getByText('Screen-owned content')
      expect(content.parentElement).toBe(button.parentElement)
      fireEvent.click(button)
      expect(onToggle).toHaveBeenCalledTimes(2)
      expect(content).toBeInTheDocument()
    }
  )

  it('defaults to the standalone panel presentation', () => {
    render(
      <NativeHelpDisclosure title="Native help" open onToggle={() => {}}>
        <p>Content</p>
      </NativeHelpDisclosure>
    )
    expect(screen.getByText('Content').parentElement).toHaveAttribute(
      'class',
      'border-fl-border bg-fl-surface border'
    )
  })
})
