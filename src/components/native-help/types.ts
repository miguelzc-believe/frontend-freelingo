export type NativeHelpOccurrence<T> = Readonly<{ key: string; value: T }>

export interface NativeHelpTrap {
  mistake: string
  fix: string
}

export interface NativeHelpGlossaryItem {
  term: string
  meaning: string
  note?: string | null
}
