import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { TargetLanguageText } from '@/components/TargetLanguageText'
import { PracticeScoreCard } from '@/components/practice/PracticeScoreCard'
import { PracticeQuestionReview } from '@/components/practice/PracticeQuestionReview'
import { PracticeResultActions } from '@/components/practice/PracticeResultActions'
import { PracticeHistoryContent } from '@/components/practice/PracticeHistoryContent'
import { PracticeQuestions } from '@/components/practice/PracticeQuestions'
import { PracticePageHeader } from '@/components/practice/PracticePageHeader'
import { PracticeEmptyState } from '@/components/practice/PracticeEmptyState'
import type { Question } from '@/types/api'

vi.mock('use-intl', () => ({
  useTranslations: () => (key: string) => `common.${key}`,
}))

const questions: Question[] = [
  {
    index: 4,
    question: 'どこですか？',
    options: { b: '駅', a: '市場', c: '学校' },
  },
  {
    index: 1,
    question: 'いつですか？',
    options: { a: '今日', b: '明日' },
  },
]

const labelClass =
  'text-fl-label text-fl-muted-3 font-mono tracking-widest uppercase'
const historyActionClass =
  'text-fl-muted-2 hover:text-fl-fg font-mono text-xs tracking-widest uppercase transition-colors'
const choiceBaseClass = 'w-full border px-3 py-2 text-left transition-colors '

function expectLanguageText(element: HTMLElement, tagName: string) {
  expect(element.tagName).toBe(tagName)
  expect(element).toHaveAttribute('lang', 'ja-JP')
  expect(element).toHaveClass(
    'font-target-ja',
    'text-base',
    'leading-loose',
    'tracking-normal',
    'normal-case'
  )
}

describe('practice presentation equivalence', () => {
  describe('score and XP card', () => {
    it.each([false, true])(
      'preserves the score card for replay=%s',
      (isReplay) => {
        const { container } = render(
          <PracticeScoreCard
            score={1}
            questionCount={2}
            xpEarned={12}
            isReplay={isReplay}
            resultsLabel="reading.resultsLabel"
            replayNoXpLabel="reading.replayNoXp"
          />
        )
        const card = container.firstElementChild
        expect(card).toHaveAttribute(
          'class',
          'border-fl-border bg-fl-surface border p-5'
        )
        expect(card?.children).toHaveLength(1)
        expect(card?.firstElementChild).toHaveAttribute(
          'class',
          'flex items-center justify-between'
        )
        expect(screen.getByText('reading.resultsLabel')).toHaveAttribute(
          'class',
          labelClass
        )
        expect(screen.getByText('1/2')).toHaveAttribute(
          'class',
          'text-fl-fg mt-1 font-mono text-2xl font-bold'
        )
        expect(screen.getByText('XP')).toHaveAttribute('class', labelClass)
        expect(screen.getByText('XP').parentElement).toHaveAttribute(
          'class',
          'text-right'
        )
        if (isReplay) {
          expect(screen.getByText('reading.replayNoXp')).toHaveAttribute(
            'class',
            'text-fl-label text-fl-muted-3 mt-1 font-mono'
          )
          expect(screen.queryByText('+12')).not.toBeInTheDocument()
        } else {
          expect(screen.getByText('+12')).toHaveAttribute(
            'class',
            'text-fl-accent mt-1 font-mono text-xl font-bold'
          )
          expect(
            screen.queryByText('reading.replayNoXp')
          ).not.toBeInTheDocument()
        }
      }
    )

    it('does not invent a score or XP reward for zero values', () => {
      render(
        <PracticeScoreCard
          score={0}
          questionCount={0}
          xpEarned={0}
          isReplay={false}
          resultsLabel="listening.resultsLabel"
          replayNoXpLabel="listening.replayNoXp"
        />
      )
      expect(screen.getByText('0/0')).toBeInTheDocument()
      expect(screen.getByText('+0')).toBeInTheDocument()
    })
  })

  describe('question review', () => {
    it('preserves question/option order, original indexes, languages and correctness classes', () => {
      const { container } = render(
        <PracticeQuestionReview
          questions={questions}
          correctAnswers={[
            { index: 1, correct: 'b' },
            { index: 4, correct: 'b' },
          ]}
          answers={{ '4': 'a', '1': 'b' }}
          languageCode="ja-JP"
          reviewLabel="listening.review"
        />
      )
      expect(container.firstElementChild).toHaveAttribute('class', 'space-y-3')
      expect(screen.getByText('listening.review')).toHaveAttribute(
        'class',
        labelClass
      )
      const firstQuestion = screen.getByText('5. どこですか？')
      const secondQuestion = screen.getByText('2. いつですか？')
      expectLanguageText(firstQuestion, 'P')
      expect(firstQuestion).toHaveClass('text-fl-fg', 'mb-3')
      expectLanguageText(secondQuestion, 'P')
      expect(firstQuestion.parentElement).toHaveAttribute(
        'class',
        'border p-4 border-fl-error-fg/50 bg-fl-error-fg/5'
      )
      expect(secondQuestion.parentElement).toHaveAttribute(
        'class',
        'border p-4 border-fl-success/50 bg-fl-success/5'
      )
      const options = firstQuestion.nextElementSibling
      expect(options).toHaveAttribute('class', 'space-y-1')
      expect(
        Array.from(options?.children ?? [], (option) => option.textContent)
      ).toEqual(['b. 駅', 'a. 市場', 'c. 学校'])
      expect(screen.getByText('駅').parentElement).toHaveAttribute(
        'class',
        'px-3 py-1.5 text-fl-success font-bold'
      )
      expect(screen.getByText('市場').parentElement).toHaveAttribute(
        'class',
        'px-3 py-1.5 text-fl-error-fg line-through'
      )
      expect(screen.getByText('学校').parentElement).toHaveAttribute(
        'class',
        'px-3 py-1.5 text-fl-muted-1'
      )
      expect(screen.getByText('明日').parentElement).toHaveAttribute(
        'class',
        'px-3 py-1.5 text-fl-success font-bold'
      )
      expect(screen.getByText('今日').parentElement).toHaveAttribute(
        'class',
        'px-3 py-1.5 text-fl-muted-1'
      )
      expectLanguageText(screen.getByText('駅'), 'SPAN')
      expect(
        within(firstQuestion.parentElement!).getByText('b.')
      ).toHaveAttribute('class', 'text-fl-label font-mono font-bold')
      expect(screen.queryByRole('button')).not.toBeInTheDocument()
      expect(container.querySelector('.word-selectable')).toBeNull()
    })

    it('keeps the original first-match and missing-answer review behavior', () => {
      const { container } = render(
        <PracticeQuestionReview
          questions={questions}
          correctAnswers={[
            { index: 4, correct: 'b' },
            { index: 4, correct: 'a' },
          ]}
          answers={{ '4': 'b' }}
          languageCode="ja-JP"
          reviewLabel="reading.review"
        />
      )
      expect(screen.getByText('駅').parentElement).toHaveClass(
        'text-fl-success'
      )
      expect(screen.getByText('市場').parentElement).toHaveClass(
        'text-fl-muted-1'
      )
      // Both undefined values compared equal in the original pages as well.
      expect(screen.getByText('2. いつですか？').parentElement).toHaveClass(
        'border-fl-success/50'
      )
      expect(container.querySelectorAll('.line-through')).toHaveLength(0)
    })
  })

  describe('question choices', () => {
    it.each([
      {
        modality: 'reading' as const,
        selectedClass: 'border-fl-accent text-fl-fg bg-fl-surface-2',
        unselectedClass:
          'border-fl-border text-fl-muted-1 hover:border-fl-muted-2 hover:text-fl-fg',
      },
      {
        modality: 'listening' as const,
        selectedClass: 'border-fl-accent bg-fl-surface-2 text-fl-fg',
        unselectedClass:
          'border-fl-border text-fl-muted-1 hover:border-fl-border-2 hover:text-fl-fg hover:bg-fl-surface-2',
      },
    ])(
      'retains $modality option styles, controlled answers and selection context',
      ({ modality, selectedClass, unselectedClass }) => {
        const onAnswer = vi.fn()
        const onTextSelection = vi.fn()
        const props = {
          questions,
          answers: { '4': 'a' },
          languageCode: 'ja-JP',
          level: 'B2',
          modality,
          onAnswer,
          onTextSelection,
        }
        const { container, rerender } = render(<PracticeQuestions {...props} />)
        expect(container.firstElementChild).toHaveAttribute(
          'class',
          'space-y-4'
        )
        const question = screen.getByText('5. どこですか？')
        expectLanguageText(question, 'P')
        expect(question).toHaveClass(
          'text-fl-fg',
          'word-selectable',
          'mb-3',
          'cursor-text',
          'select-text'
        )
        expect(question.parentElement).toHaveAttribute(
          'class',
          'border-fl-border bg-fl-surface border p-4'
        )
        expect(question.nextElementSibling).toHaveAttribute(
          'class',
          'space-y-2'
        )
        const selected = screen.getByRole('button', { name: 'a. 市場' })
        const unselected = screen.getByRole('button', { name: 'b. 駅' })
        expect(selected).toHaveAttribute(
          'class',
          choiceBaseClass + selectedClass
        )
        expect(unselected).toHaveAttribute(
          'class',
          choiceBaseClass + unselectedClass
        )
        expect(
          screen.getAllByRole('button').map((button) => button.textContent)
        ).toEqual(['b. 駅', 'a. 市場', 'c. 学校', 'a. 今日', 'b. 明日'])
        expectLanguageText(screen.getByText('市場'), 'SPAN')
        expect(within(selected).getByText('a.')).toHaveAttribute(
          'class',
          'text-fl-label font-mono font-bold'
        )
        fireEvent.pointerUp(question)
        expect(onTextSelection).toHaveBeenCalledExactlyOnceWith(
          'どこですか？',
          'B2'
        )
        fireEvent.pointerUp(screen.getByText('駅'))
        expect(onTextSelection).toHaveBeenCalledTimes(1)
        fireEvent.click(unselected)
        expect(onAnswer).toHaveBeenCalledExactlyOnceWith(4, 'b')
        expect(selected).toHaveAttribute(
          'class',
          choiceBaseClass + selectedClass
        )
        rerender(<PracticeQuestions {...props} answers={{ '4': 'b' }} />)
        expect(unselected).toHaveAttribute(
          'class',
          choiceBaseClass + selectedClass
        )
        expect(selected).toHaveAttribute(
          'class',
          choiceBaseClass + unselectedClass
        )
      }
    )

    it('retains question and option nodes by their existing index/key when reordered', () => {
      const props = {
        questions,
        answers: {},
        languageCode: 'ja-JP',
        level: 'B1',
        modality: 'reading' as const,
        onAnswer: vi.fn(),
        onTextSelection: vi.fn(),
      }
      const { rerender } = render(<PracticeQuestions {...props} />)
      const originalQuestion = screen.getByText('5. どこですか？')
      const originalOption = screen.getByRole('button', { name: 'b. 駅' })
      const reversedQuestions = questions.toReversed().map((q) => ({
        ...q,
        options: Object.fromEntries(Object.entries(q.options).toReversed()),
      }))
      rerender(<PracticeQuestions {...props} questions={reversedQuestions} />)
      expect(screen.getByText('5. どこですか？')).toBe(originalQuestion)
      expect(screen.getByRole('button', { name: 'b. 駅' })).toBe(originalOption)
    })
  })

  describe('history cards', () => {
    const history = [
      {
        id: 17,
        score: 1,
        xp_earned: 8,
        exercise: {
          topic: '交通',
          level: 'B1',
          exercise_type: 'mcq',
          questions,
          target_language: 'ja-JP',
          text: '駅は近いです。',
        },
      },
    ]
    const historyProps = {
      historyLoading: false,
      history,
      emptyLabel: 'reading.historyEmpty',
      replayLabel: 'reading.practiceAgain',
      onReplay: vi.fn(),
      renderText: (item: (typeof history)[number]) => (
        <TargetLanguageText
          as="p"
          languageCode={item.exercise.target_language}
          className="text-fl-muted-2 border-fl-border mb-3 line-clamp-3 border-t pt-3"
        >
          {item.exercise.text}
        </TargetLanguageText>
      ),
    }

    it('preserves inline loading and empty states without rendering cards', () => {
      const renderText = vi.fn(historyProps.renderText)
      const { container, rerender } = render(
        <PracticeHistoryContent
          {...historyProps}
          history={[]}
          historyLoading
          renderText={renderText}
        />
      )
      const loading = screen.getByRole('status', { name: 'common.loading' })
      expect(loading.tagName).toBe('OUTPUT')
      expect(loading).toHaveClass('block', 'p-5')
      expect(screen.queryByText('reading.historyEmpty')).not.toBeInTheDocument()
      expect(renderText).not.toHaveBeenCalled()
      rerender(
        <PracticeHistoryContent
          {...historyProps}
          history={[]}
          renderText={renderText}
        />
      )
      expect(container.firstElementChild).toHaveAttribute(
        'class',
        'border-fl-border bg-fl-surface border p-6 text-center'
      )
      expect(screen.getByText('reading.historyEmpty')).toHaveAttribute(
        'class',
        'text-fl-muted-3 font-mono text-xs tracking-wide'
      )
      expect(screen.queryByRole('status')).not.toBeInTheDocument()
      expect(renderText).not.toHaveBeenCalled()
    })

    it('keeps populated history visible while loading and passes the unchanged item to replay', () => {
      const onReplay = vi.fn()
      const { container } = render(
        <PracticeHistoryContent
          {...historyProps}
          historyLoading
          onReplay={onReplay}
        />
      )
      expect(container.firstElementChild).toHaveAttribute('class', 'space-y-3')
      const card = container.firstElementChild?.firstElementChild
      expect(card).toHaveAttribute(
        'class',
        'border-fl-border bg-fl-surface border p-4'
      )
      expect(card?.children).toHaveLength(3)
      expect(card?.firstElementChild).toHaveAttribute(
        'class',
        'mb-3 flex items-start justify-between gap-4'
      )
      expect(screen.getByText('交通')).toHaveAttribute(
        'class',
        'text-fl-fg truncate font-mono text-xs font-bold tracking-wide'
      )
      expect(screen.getByText('交通').parentElement).toHaveAttribute(
        'class',
        'min-w-0'
      )
      expect(screen.getByText('B1 · mcq')).toHaveAttribute(
        'class',
        'text-fl-label text-fl-muted-3 mt-0.5 font-mono tracking-widest uppercase'
      )
      expect(screen.getByText('1/2')).toHaveAttribute(
        'class',
        'text-fl-fg font-mono text-xs font-bold'
      )
      expect(screen.getByText('1/2').parentElement).toHaveAttribute(
        'class',
        'shrink-0 text-right'
      )
      expect(screen.getByText('+8 XP')).toHaveAttribute(
        'class',
        'text-fl-label text-fl-accent font-mono'
      )
      const text = screen.getByText('駅は近いです。')
      expect(text.parentElement).toBe(card)
      expectLanguageText(text, 'P')
      expect(text).toHaveClass('line-clamp-3', 'border-t', 'pt-3')
      const replay = screen.getByRole('button', {
        name: 'reading.practiceAgain',
      })
      expect(replay).toHaveAttribute('class', historyActionClass)
      fireEvent.click(replay)
      expect(onReplay).toHaveBeenCalledExactlyOnceWith(history[0])
      expect(onReplay.mock.calls[0]?.[0]).toBe(history[0])
      expect(screen.queryByRole('status')).not.toBeInTheDocument()
    })

    it('renders the listening text slot directly without changing its selection handler', () => {
      const onTextSelection = vi.fn()
      render(
        <PracticeHistoryContent
          {...historyProps}
          renderText={(item) => (
            <TargetLanguageText
              as="p"
              languageCode={item.exercise.target_language}
              className="text-fl-muted-2 border-fl-border word-selectable mb-3 cursor-text border-t pt-3 select-text"
              onPointerUp={() =>
                onTextSelection(item.exercise.text, item.exercise.level)
              }
            >
              {item.exercise.text}
            </TargetLanguageText>
          )}
        />
      )
      const text = screen.getByText('駅は近いです。')
      expect(text).toHaveClass('word-selectable', 'cursor-text', 'select-text')
      expect(text).not.toHaveClass('line-clamp-3')
      fireEvent.pointerUp(text)
      expect(onTextSelection).toHaveBeenCalledExactlyOnceWith(
        '駅は近いです。',
        'B1'
      )
    })

    it('retains card nodes by attempt ID when history changes order', () => {
      const second = {
        ...history[0]!,
        id: 18,
        exercise: { ...history[0]!.exercise, topic: '買い物' },
      }
      const items = [...history, second]
      const { rerender } = render(
        <PracticeHistoryContent {...historyProps} history={items} />
      )
      const original = screen.getByText('交通')
      rerender(
        <PracticeHistoryContent
          {...historyProps}
          history={items.toReversed()}
        />
      )
      expect(screen.getByText('交通')).toBe(original)
    })
  })

  it('preserves result action labels/classes and always opens history at page zero', () => {
    const onNext = vi.fn()
    const onHistory = vi.fn()
    const { container } = render(
      <PracticeResultActions
        onNext={onNext}
        onHistory={onHistory}
        nextLabel="reading.nextExercise"
        historyLabel="reading.viewHistory"
      />
    )
    expect(container.firstElementChild).toHaveAttribute(
      'class',
      'flex gap-3 pt-1'
    )
    const next = screen.getByRole('button', { name: 'reading.nextExercise' })
    const history = screen.getByRole('button', { name: 'reading.viewHistory' })
    expect(next).toHaveAttribute(
      'class',
      'border-fl-border bg-fl-surface text-fl-fg hover:bg-fl-surface-2 flex-1 border py-3 font-mono text-sm tracking-widest uppercase transition-colors'
    )
    expect(history).toHaveAttribute(
      'class',
      'border-fl-border bg-fl-surface text-fl-muted-2 hover:text-fl-fg hover:bg-fl-surface-2 border px-4 py-3 font-mono text-xs tracking-widest uppercase transition-colors'
    )
    fireEvent.click(next)
    fireEvent.click(history)
    expect(onNext).toHaveBeenCalledTimes(1)
    expect(onHistory).toHaveBeenCalledExactlyOnceWith(0)
  })

  it('preserves history/idle header structure and the original action', () => {
    const onAction = vi.fn()
    const { container } = render(
      <PracticePageHeader
        title="listening.historyTitle"
        actionLabel="listening.practiceMore"
        onAction={onAction}
      />
    )
    expect(container.firstElementChild).toHaveAttribute(
      'class',
      'mb-6 flex items-center justify-between'
    )
    expect(
      screen.getByRole('heading', { name: 'listening.historyTitle', level: 1 })
    ).toHaveAttribute(
      'class',
      'text-fl-fg font-mono text-sm font-bold tracking-widest uppercase'
    )
    const action = screen.getByRole('button', {
      name: 'listening.practiceMore',
    })
    expect(action).toHaveAttribute('class', historyActionClass)
    fireEvent.click(action)
    expect(onAction).toHaveBeenCalledTimes(1)
  })

  it('preserves the empty-state text and generation action', () => {
    const onGenerate = vi.fn()
    const { container } = render(
      <PracticeEmptyState
        label="reading.noExercises"
        generateLabel="reading.generate"
        onGenerate={onGenerate}
      />
    )
    expect(container.firstElementChild).toHaveAttribute(
      'class',
      'border-fl-border bg-fl-surface flex flex-col items-center gap-5 border p-8 text-center'
    )
    expect(screen.getByText('reading.noExercises')).toHaveAttribute(
      'class',
      'text-fl-muted-2 font-mono text-xs tracking-wide'
    )
    const generate = screen.getByRole('button', { name: 'reading.generate' })
    expect(generate).toHaveAttribute(
      'class',
      'border-fl-border bg-fl-surface text-fl-fg hover:bg-fl-surface-2 border px-8 py-3 font-mono text-sm tracking-widest uppercase transition-colors'
    )
    fireEvent.click(generate)
    expect(onGenerate).toHaveBeenCalledTimes(1)
  })
})
