import { Link } from '@tanstack/react-router'
import type { AnchorHTMLAttributes } from 'react'

export default function AppLink({
  href = '/',
  target,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement>) {
  return <Link to="." href={href} {...props} {...(target ? { target } : {})} />
}
