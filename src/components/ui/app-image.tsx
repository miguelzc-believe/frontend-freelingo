import type { ImgHTMLAttributes } from 'react'

interface Props extends ImgHTMLAttributes<HTMLImageElement> {
  src: string
  alt: string
  priority?: boolean
  unoptimized?: boolean
  fill?: boolean
}

/** Local assets keep dimensions and lazy loading without a framework image endpoint. */
export default function AppImage({
  alt,
  priority,
  unoptimized: _unoptimized,
  fill,
  style,
  ...props
}: Readonly<Props>) {
  return (
    <img
      {...props}
      alt={alt}
      loading={priority ? 'eager' : (props.loading ?? 'lazy')}
      decoding="async"
      style={
        fill
          ? {
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              ...style,
            }
          : style
      }
    />
  )
}
