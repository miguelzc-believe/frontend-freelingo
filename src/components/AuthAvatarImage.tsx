import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import Image from '@/components/ui/app-image'
import { loadAvatar, subscribeAvatar } from '@/lib/avatar-cache'
import { useAuthStore } from '@/store/auth'

interface Props {
  avatar: string
  alt?: string
  width: number
  height: number
  className?: string
  fallback?: ReactNode
}

export function AuthAvatarImage({
  avatar,
  alt = '',
  width,
  height,
  className,
  fallback = null,
}: Props) {
  const accessToken = useAuthStore((state) => state.accessToken)
  const [src, setSrc] = useState<string | null>(null)

  useEffect(() => {
    const unsubscribe = subscribeAvatar(setSrc)
    void loadAvatar(avatar, accessToken)
    return unsubscribe
  }, [accessToken, avatar])

  if (!src) return fallback

  return (
    <Image
      src={src}
      alt={alt}
      width={width}
      height={height}
      className={className}
      unoptimized
    />
  )
}
