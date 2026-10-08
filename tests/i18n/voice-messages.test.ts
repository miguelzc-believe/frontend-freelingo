import { createTranslator } from 'use-intl'
import { describe, expect, it } from 'vitest'

import { SUPPORTED_LOCALES } from '@/lib/locales'
import en from '../../messages/en.json'

const voiceMessageKeys = [
  'record',
  'stopAndSend',
  'endSession',
  'recording',
  'sending',
  'ready',
  'retry',
  'retryCount',
  'transcriptionFailed',
  'retryLimit',
  'processing',
  'play',
  'pause',
  'progress',
  'playbackBlocked',
  'playbackFailed',
  'audioExpired',
  'recordingLimit',
  'cancelled',
  'emptyRecording',
  'microphoneUnavailable',
  'sessionExpired',
  'replyFailed',
] as const

const messageKeys = [
  'assessment.voiceTrialLabel',
  'assessment.voiceTrialTitle',
  'assessment.voiceTrialDesc',
  'assessment.voiceTrialStart',
  'assessment.voiceTrialSkip',
  'conversation.trialBanner',
  'conversation.trialCtaLabel',
  'conversation.trialCtaTitle',
  'conversation.trialCtaDesc',
  'conversation.errorTranscription',
  'conversation.errorResponse',
  'conversation.errorSpeech',
  'conversation.errorVoiceServicesUnavailable',
  'listening.generationFailed',
  'conversation.tapToStart',
  'landing.feature3Desc',
  'settings.conversationDescription',
  ...voiceMessageKeys.map(
    (key) => `conversation.voiceMessages.${key}` as const
  ),
] as const

const interpolation = { minutes: 5, count: 1, max: 2, seconds: 120 }

const english = createTranslator({
  locale: 'en',
  messages: en,
  onError: (error) => {
    throw error
  },
})

describe.each(SUPPORTED_LOCALES)('voice messages in %s', (locale) => {
  it('renders translated voice and listening messages without English fallback', async () => {
    const messages = (await import(`../../messages/${locale}.json`)).default
    const t = createTranslator({
      locale,
      messages,
      onError: (error) => {
        throw error
      },
    })

    expect(Object.keys(messages.conversation.voiceMessages).sort()).toEqual(
      [...voiceMessageKeys].sort()
    )

    for (const key of messageKeys) {
      // Read the locale's own JSON, not a merged catalogue that hides omissions.
      const raw = key.split('.').reduce<unknown>((value, part) => {
        if (!value || typeof value !== 'object') return undefined
        return (value as Record<string, unknown>)[part]
      }, messages)
      expect(typeof raw, key).toBe('string')
      expect(raw, key).not.toBe('')
      expect(t.has(key), key).toBe(true)

      const rendered = t(key, interpolation)
      expect(rendered.trim(), key).not.toBe('')
      expect(rendered, key).not.toBe(key)
      expect(rendered, key).not.toMatch(/\{(?:minutes|count|max|seconds)\}/)
      if (locale !== 'en') {
        expect(rendered, key).not.toBe(english(key, interpolation))
      }
    }
  })

  it('interpolates both manual retry counts and the recording limit', async () => {
    const messages = (await import(`../../messages/${locale}.json`)).default
    const t = createTranslator({
      locale,
      messages,
      onError: (error) => {
        throw error
      },
    })
    const { retryCount, recordingLimit } = messages.conversation.voiceMessages
    expect(retryCount).toContain('{count}')
    expect(retryCount).toContain('{max}')
    expect(recordingLimit).toContain('{seconds}')

    for (const count of [0, 1, 2]) {
      const rendered = t('conversation.voiceMessages.retryCount', {
        count,
        max: 2,
      })
      expect(rendered).toContain(String(count))
      expect(rendered).toContain('2')
      expect(rendered).not.toMatch(/\{(?:count|max)\}/)
    }
    expect(
      t('conversation.voiceMessages.retryCount', { count: 1, max: 2 })
    ).not.toBe(t('conversation.voiceMessages.retryCount', { count: 1, max: 3 }))

    for (const seconds of [30, 120]) {
      const rendered = t('conversation.voiceMessages.recordingLimit', {
        seconds,
      })
      expect(rendered).toContain(String(seconds))
      expect(rendered).not.toContain('{seconds}')
    }
  })

  it('describes explicit recording, sending and separate session ending', async () => {
    const messages = (await import(`../../messages/${locale}.json`)).default
    const t = createTranslator({
      locale,
      messages,
      onError: (error) => {
        throw error
      },
    })
    const record = t('conversation.voiceMessages.record')
    const stopAndSend = t('conversation.voiceMessages.stopAndSend')
    const endSession = t('conversation.voiceMessages.endSession')
    const faq = t.rich('faq.a_voice', { strong: (text) => text })

    expect(typeof faq).toBe('string')
    expect(faq).toContain(record)
    expect(faq).toContain(stopAndSend)
    expect(faq).toContain(endSession)
    expect(t('conversation.tapToStart')).toContain(record)
    expect(t('conversation.tapToStart')).toContain(stopAndSend)
    expect(t('settings.conversationDescription')).toContain(record)
    expect(t('settings.conversationDescription')).toContain(stopAndSend)
    expect(stopAndSend).not.toBe(endSession)
    expect(faq).not.toMatch(/\bVAD\b|barge-in|voice activity detection/i)
    expect(t('landing.feature3Desc')).not.toMatch(
      /voice-activated|no turn-taking/i
    )
    if (locale !== 'en') {
      expect(faq).not.toBe(
        english.rich('faq.a_voice', { strong: (text) => text })
      )
    }
  })
})

describe('voice message workflow copy', () => {
  it('explains manual retries of the same recording and session-only audio', () => {
    const faq = english.rich('faq.a_voice', { strong: (text) => text })
    expect(faq).toContain('does not end the session')
    expect(faq).toContain('does not listen automatically between messages')
    expect(faq).toContain(
      'manually retry the same recording up to twice after the initial attempt'
    )
    expect(faq).toContain(
      'recordings are deleted and only transcripts are kept'
    )
    expect(english('conversation.voiceMessages.transcriptionFailed')).toContain(
      'same recording'
    )
    expect(english('conversation.voiceMessages.retryLimit')).toContain(
      'Both transcription retries'
    )
    expect(english('conversation.voiceMessages.audioExpired')).toContain(
      'Only the transcript is kept'
    )
  })
})
