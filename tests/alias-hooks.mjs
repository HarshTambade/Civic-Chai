// Resolves the app's "@/..." import alias to TypeScript sources for `node --test`.
import { statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const root = new URL('../', import.meta.url)

function isFile(url) {
  try {
    return statSync(fileURLToPath(url)).isFile()
  } catch {
    return false
  }
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('@/')) {
    const base = new URL(specifier.slice(2), root).href
    const match = ['', '.ts', '.tsx', '/index.ts'].map((suffix) => base + suffix).find(isFile)
    if (match) return nextResolve(match, context)
  }
  return nextResolve(specifier, context)
}
