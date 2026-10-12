import { useState } from 'react'

type PasswordFieldProps = {
  label: string
  value: string
  onChange: (value: string) => void
  showPasswordLabel: string
  hidePasswordLabel: string
  autoComplete?: 'current-password' | 'new-password'
  required?: boolean
}

export function PasswordField({
  label,
  value,
  onChange,
  showPasswordLabel,
  hidePasswordLabel,
  autoComplete,
  required,
}: Readonly<PasswordFieldProps>) {
  const [showPassword, setShowPassword] = useState(false)

  return (
    <div>
      <label className="text-fl-muted-2 mb-2 block font-mono text-xs tracking-widest uppercase">
        {label}
      </label>
      <div className="relative">
        <input
          type={showPassword ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          autoComplete={autoComplete}
          autoCorrect="off"
          autoCapitalize="none"
          spellCheck={false}
          className="bg-fl-bg border-fl-border text-fl-fg focus:border-fl-border-2 w-full border px-4 py-3 pr-11 font-mono text-sm transition-colors focus:outline-none"
        />
        <button
          type="button"
          onClick={() => setShowPassword((v) => !v)}
          className="text-fl-muted-4 hover:text-fl-muted-0 absolute inset-y-0 right-0 flex items-center px-3 transition-colors"
          aria-label={showPassword ? hidePasswordLabel : showPasswordLabel}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {showPassword ? (
              <>
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                <line x1="1" y1="1" x2="23" y2="23" />
              </>
            ) : (
              <>
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </>
            )}
          </svg>
        </button>
      </div>
    </div>
  )
}
