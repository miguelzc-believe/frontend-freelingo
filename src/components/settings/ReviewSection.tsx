import { useEffect, useState } from 'react'
import { useTranslations } from 'use-intl'
import { Loader2, Trash2 } from 'lucide-react'
import { ReviewForm } from '@/components/reviews/ReviewPrompt'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import {
  createReview,
  deleteMyReview,
  fetchMyReview,
  updateMyReview,
} from '@/lib/reviews'
import type { ReviewAdmin } from '@/types/api'

export function ReviewSection({ title }: { title?: string } = {}) {
  const t = useTranslations('settings')
  const tReview = useTranslations('reviewPrompt')
  const [review, setReview] = useState<ReviewAdmin | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [deleted, setDeleted] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    fetchMyReview()
      .then((data) => {
        if (!cancelled) setReview(data.review)
      })
      .catch(() => {
        if (!cancelled) setError(tReview('statusError'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [tReview])

  async function handleDelete() {
    setDeleting(true)
    setError('')
    try {
      await deleteMyReview()
      setReview(null)
      setDeleteConfirm(false)
      setDeleted(true)
      window.setTimeout(() => setDeleted(false), 2500)
    } catch {
      setError(t('reviewDeleteError'))
    } finally {
      setDeleting(false)
    }
  }

  let content: React.ReactNode
  if (loading) {
    content = (
      <div className="text-fl-muted-2 flex items-center gap-2 py-5 font-mono text-xs">
        <Loader2 className="size-4 animate-spin" /> {tReview('checking')}
      </div>
    )
  } else if (error) {
    content = <p className="text-fl-error-fg py-5 font-mono text-xs">{error}</p>
  } else {
    content = (
      <div className="-mx-5">
        <ReviewForm
          initialReview={review}
          submitLabel={review ? t('reviewUpdate') : tReview('submit')}
          onSubmit={async (data) => {
            const savedReview = review
              ? await updateMyReview(data)
              : await createReview(data)
            setReview(savedReview)
            setSaved(true)
            setDeleted(false)
            window.setTimeout(() => setSaved(false), 2500)
            return savedReview
          }}
        />
        {review && (
          <div className="px-5 pb-5">
            <button
              type="button"
              onClick={() => setDeleteConfirm(true)}
              disabled={deleting}
              className="border-fl-error/30 text-fl-error-fg text-fl-label hover:bg-fl-error/10 flex w-full items-center justify-center gap-2 border py-3 font-mono font-bold tracking-widest uppercase transition-colors disabled:opacity-60"
            >
              {deleting ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Trash2 className="size-3.5" />
              )}
              {t('reviewDelete')}
            </button>
          </div>
        )}
        {saved && (
          <p className="text-fl-accent px-5 pb-5 font-mono text-xs">
            {t('reviewSaved')}
          </p>
        )}
        {deleted && (
          <p className="text-fl-accent px-5 pb-5 font-mono text-xs">
            {t('reviewDeleted')}
          </p>
        )}
      </div>
    )
  }

  return (
    <>
      <div className="border-fl-border bg-fl-surface border p-6">
        <div className="border-fl-border mb-4 flex items-center gap-2 border-b pb-4">
          <span className="text-fl-label text-fl-muted-2">●</span>
          <span className="text-fl-label text-fl-muted-2 font-mono tracking-widest uppercase">
            {title ?? t('sectionReview')}
          </span>
        </div>

        <p className="text-fl-muted-2 mb-1 font-mono text-sm leading-relaxed">
          {t('reviewDescription')}
        </p>
        {review?.is_approved === false && (
          <p className="text-fl-hint text-fl-muted-4 mb-4 font-mono tracking-widest uppercase">
            {t('reviewPending')}
          </p>
        )}

        {content}
      </div>

      <ConfirmDialog
        open={deleteConfirm}
        title={t('reviewDeleteTitle')}
        message={t('reviewDeleteMessage')}
        confirmLabel={t('reviewDeleteConfirm')}
        danger
        onCancel={() => setDeleteConfirm(false)}
        onConfirm={handleDelete}
      />
    </>
  )
}
