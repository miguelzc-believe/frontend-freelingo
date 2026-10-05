import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  allocateMessageId,
  createMessage,
  mergeMessage,
} from '@/lib/chat-messages'

afterEach(() => vi.restoreAllMocks())

describe('client chat message identity', () => {
  it('allocates opaque identities only when records are created', () => {
    const uuid = vi
      .spyOn(globalThis.crypto, 'randomUUID')
      .mockReturnValueOnce('00000000-0000-4000-8000-000000000001')
      .mockReturnValueOnce('00000000-0000-4000-8000-000000000002')
      .mockReturnValueOnce('00000000-0000-4000-8000-000000000003')
    expect(allocateMessageId()).toBe('00000000-0000-4000-8000-000000000001')
    const first = createMessage({ role: 'assistant', content: 'Same' })
    const second = createMessage({ role: 'assistant', content: 'Same' })
    expect(first).toEqual({
      id: '00000000-0000-4000-8000-000000000002',
      role: 'assistant',
      content: 'Same',
    })
    expect(second.id).not.toBe(first.id)
    expect(uuid).toHaveBeenCalledTimes(3)
  })

  it('replaces by identity rather than position and preserves duplicate records', () => {
    const first = createMessage({ role: 'assistant', content: 'Same' })
    const last = createMessage({ role: 'user', content: 'Same' })
    const records = [first, last]
    const updated = mergeMessage(records, { ...first, content: 'Token' })
    expect(updated).toEqual([{ ...first, content: 'Token' }, last])
    expect(updated[1]).toBe(last)
    expect(records).toEqual([first, last])
    const reset = mergeMessage(updated, { ...first, content: '' })
    expect(reset[0]).toEqual({ ...first, content: '' })
    expect(reset[0]?.id).toBe(first.id)
    const done = mergeMessage(reset, { ...first, content: 'Final' })
    expect(done[0]?.id).toBe(first.id)
    expect(done[1]).toBe(last)
  })

  it('appends a new identity once, including to an empty list', () => {
    const message = createMessage({ role: 'user', content: 'Hello' })
    expect(mergeMessage([], message)).toEqual([message])
    expect(mergeMessage([message], message)).toEqual([message])
    const other = createMessage({ role: 'user', content: 'Hello' })
    expect(mergeMessage([message], other)).toEqual([message, other])
  })
})
