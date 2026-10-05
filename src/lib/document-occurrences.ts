type DocumentPath = readonly string[]

/** Identify authored items by section, authored value and its repetition ordinal.
 * Call on the complete section before filtering; these are not persistent IDs.
 */
export function documentOccurrences<T>(
  path: DocumentPath,
  values: readonly T[]
) {
  const repetitions = new Map<string, number>()
  return values.map((value) => {
    const authored = JSON.stringify(value)
    const occurrence = repetitions.get(authored) ?? 0
    repetitions.set(authored, occurrence + 1)
    return { key: JSON.stringify([...path, authored, occurrence]), value }
  })
}

/** Retain split output exactly, including captures and empty segments. */
export function documentRanges(
  path: DocumentPath,
  text: string,
  separator: string | RegExp
) {
  let offset = 0
  return text.split(separator).map((value) => {
    const start = offset
    const end = start + value.length
    offset = end + (typeof separator === 'string' ? separator.length : 0)
    // Adjacent empty captures can share a range with a token's boundary,
    // but no two split segments have the same start AND end.
    return { key: JSON.stringify([...path, start, end]), value, start, end }
  })
}
