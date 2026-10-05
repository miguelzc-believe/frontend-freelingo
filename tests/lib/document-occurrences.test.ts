import { describe, expect, it } from 'vitest'
import { documentOccurrences, documentRanges } from '@/lib/document-occurrences'

describe('immutable authored occurrences', () => {
  it('retains duplicate identities across filtering and unrelated section changes', () => {
    const authored = documentOccurrences(
      ['topic', 'rules'],
      ['same', 'other', 'same']
    )
    expect(new Set(authored.map((item) => item.key)).size).toBe(3)
    const filtered = authored.filter((item) => item.value === 'same')
    expect(filtered.map((item) => item.key)).toEqual([
      authored[0]?.key,
      authored[2]?.key,
    ])
    expect(
      documentOccurrences(['topic', 'rules'], ['same', 'same']).map(
        (item) => item.key
      )
    ).toEqual(filtered.map((item) => item.key))
    expect(
      documentOccurrences(['topic', 'examples'], ['same'])[0]?.key
    ).not.toBe(authored[0]?.key)
  })

  it('restores authored duplicate keys after exclusion without renumbering the document', () => {
    const values = [{ word: 'same' }, { word: 'other' }, { word: 'same' }]
    const authored = documentOccurrences(
      ['vocabulary', 'set/one', 'words'],
      values
    )
    const selected = authored.filter(({ value }) => value.word === 'same')
    expect(new Set(selected.map(({ key }) => key)).size).toBe(2)
    expect(
      authored.filter(({ value }) => value.word === 'absent')
    ).toHaveLength(0)
    const restored = documentOccurrences(
      ['vocabulary', 'set/one', 'words'],
      values
    )
    expect(restored.map(({ key }) => key)).toEqual(
      authored.map(({ key }) => key)
    )
    expect(
      restored
        .filter(({ value }) => value.word === 'same')
        .map(({ key }) => key)
    ).toEqual(selected.map(({ key }) => key))
    expect(
      documentOccurrences(['vocabulary', 'set/two', 'words'], values)[0]?.key
    ).not.toBe(authored[0]?.key)
  })

  it('keys duplicate lines and pipe cells by original source ranges before removing blanks', () => {
    const lines = documentRanges(['topic', 'explanation'], 'same\n\nsame', '\n')
    expect(lines.map(({ start, end }) => [start, end])).toEqual([
      [0, 4],
      [5, 5],
      [6, 10],
    ])
    expect(new Set(lines.map((line) => line.key)).size).toBe(3)
    const cells = documentRanges(
      [lines[0]?.key ?? 'missing-line', 'cells'],
      '|same||same|',
      '|'
    )
    expect(
      cells.filter((cell) => cell.value).map((cell) => cell.start)
    ).toEqual([1, 7])
    expect(cells[1]?.key).not.toBe(cells[3]?.key)
  })

  it('preserves captured inline split output including empty spans and repeated words', () => {
    const text = '**same**`same` **same**'
    const tokens = documentRanges(['line'], text, /(\*\*[^*]+\*\*|`[^`]+`)/)
    expect(tokens.map((token) => token.value)).toEqual(
      text.split(/(\*\*[^*]+\*\*|`[^`]+`)/)
    )
    expect(new Set(tokens.map((token) => token.key)).size).toBe(tokens.length)
    expect(
      tokens
        .filter((token) => token.value === '**same**')
        .map((token) => token.start)
    ).toEqual([0, 15])
  })
})
