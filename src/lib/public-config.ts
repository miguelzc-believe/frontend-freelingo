let config = { publicApiUrl: '', umamiWebsiteId: '' }
export function setPublicConfig(value: typeof config) {
  config = value
}
export function getPublicConfig() {
  return config
}
