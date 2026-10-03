import { Link } from '@tanstack/react-router'
import type { AnchorHTMLAttributes } from 'react'

export default function AppLink({
  href = '/',
  target,
  ...props
}: Readonly<AnchorHTMLAttributes<HTMLAnchorElement>>) {
  return <Link to="." href={href} {...props} {...(target ? { target } : {})} />
}
