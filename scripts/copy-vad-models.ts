import { createRequire } from 'node:module'
import { dirname } from 'node:path'
import { copyFile, mkdir, readdir } from 'node:fs/promises'

const require = createRequire(import.meta.url)
const vadEntry = require.resolve('@ricky0123/vad-web')
const vadRequire = createRequire(vadEntry)
const sources = [
  dirname(vadEntry),
  dirname(vadRequire.resolve('onnxruntime-web')),
]
const destination = new URL('../public/vad/', import.meta.url)
await mkdir(destination, { recursive: true })
for (const source of sources) {
  for (const file of await readdir(source)) {
    if (
      /\.(?:onnx|wasm|mjs)$/.test(file) ||
      file === 'vad.worklet.bundle.min.js'
    ) {
      await copyFile(`${source}/${file}`, new URL(file, destination))
    }
  }
}
