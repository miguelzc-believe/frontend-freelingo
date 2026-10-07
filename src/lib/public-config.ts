let config = { publicApiUrl: '', umamiWebsiteId: '' }
export function setPublicConfig(value: typeof config) {
  config = value
}
export function getPublicConfig() {
  if (typeof document !== 'undefined') {
    const publicApiUrl = document.querySelector<HTMLMetaElement>(
      'meta[name="fl-public-api-url"]'
    )?.content
    if (publicApiUrl !== undefined) return { ...config, publicApiUrl }
  }
  return config
}
