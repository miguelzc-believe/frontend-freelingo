export interface MessageContent {
  role: 'user' | 'assistant'
  content: string
}

// Client-local record identity, never a backend conversation/message identifier.
export interface Message extends MessageContent {
  id: string
}

export function allocateMessageId(): string {
  return globalThis.crypto.randomUUID()
}

export function createMessage(message: MessageContent): Message {
  return {
    id: allocateMessageId(),
    role: message.role,
    content: message.content,
  }
}

// Callers allocate records before state updates; merging never allocates IDs.
export function mergeMessage(messages: Message[], message: Message): Message[] {
  if (!messages.some((record) => record.id === message.id)) {
    return [...messages, message]
  }
  return messages.map((record) => (record.id === message.id ? message : record))
}
