type LegalSectionProps = {
  title: string
  body: string
  items?: readonly string[]
  footer?: string
}

export function LegalSection({
  title,
  body,
  items,
  footer,
}: Readonly<LegalSectionProps>) {
  return (
    <section className="space-y-3">
      <h2 className="text-fl-fg font-mono text-sm font-bold tracking-widest uppercase">
        {title}
      </h2>
      <p className="text-fl-fg-2 font-mono text-sm leading-relaxed">{body}</p>
      {items && (
        <ul className="space-y-1 pl-4">
          {items.map((item) => (
            <li
              key={item}
              className="text-fl-fg-2 flex gap-2 font-mono text-sm leading-relaxed"
            >
              <span className="text-fl-muted-2 flex-shrink-0">—</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )}
      {footer !== undefined && (
        <p className="text-fl-fg-2 font-mono text-sm leading-relaxed">
          {footer}
        </p>
      )}
    </section>
  )
}
