import { NATIVE_LANGUAGE_CODES } from '@/lib/native-languages'

/** Native-language choices only; UI locales and target variants stay separate. */
export function NativeLanguageField({
  label,
  value,
  onChange,
  languageName,
}: Readonly<{
  label: string
  value: string
  onChange: (value: string) => void
  languageName: (code: (typeof NATIVE_LANGUAGE_CODES)[number]) => string
}>) {
  return (
    <div>
      <label className="text-fl-muted-2 mb-2 block font-mono text-xs tracking-widest uppercase">
        {label}
      </label>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="bg-fl-bg border-fl-border text-fl-fg focus:border-fl-border-2 w-full appearance-none border px-4 py-3 font-mono text-sm transition-colors focus:outline-none"
      >
        {[...NATIVE_LANGUAGE_CODES]
          .sort((a, b) => languageName(a).localeCompare(languageName(b)))
          .map((code) => (
            <option key={code} value={code}>
              {languageName(code)}
            </option>
          ))}
      </select>
    </div>
  )
}
