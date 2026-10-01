import config from './stryker.config.json' with { type: 'json' }

export default {
  ...config,
  mutate: [
    'src/lib/session.ts',
    'src/lib/api.ts',
    'src/lib/assessment-answers.ts',
    'src/store/language.ts',
  ],
  htmlReporter: { fileName: 'reports/mutation/core.html' },
  jsonReporter: { fileName: 'reports/mutation/core.json' },
  incrementalFile: 'reports/mutation/core-incremental.json',
}
