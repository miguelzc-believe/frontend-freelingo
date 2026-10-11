import Link from '@/components/ui/app-link'
import Image from '@/components/ui/app-image'

type BrandProps = {
  variant: 'auth' | 'legal'
  tagline: string
}

export function Brand({ variant, tagline }: BrandProps) {
  const isLegal = variant === 'legal'
  const logo = (
    <Image
      src="/logo.png"
      alt="FreeLingo"
      width={isLegal ? 48 : 100}
      height={isLegal ? 48 : 100}
      className={isLegal ? 'mb-3' : 'mb-4'}
    />
  )

  return (
    <div className="mb-10 flex flex-col items-center">
      {isLegal ? <Link href="/">{logo}</Link> : logo}
      <h1 className="text-fl-fg font-code text-xl font-bold tracking-widest uppercase">
        FreeLingo
      </h1>
      <p className="text-fl-caption text-fl-muted-2 mt-1 font-mono tracking-widest uppercase">
        {tagline}
      </p>
    </div>
  )
}
