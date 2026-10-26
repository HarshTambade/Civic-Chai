import { register } from 'node:module'

register('./alias-hooks.mjs', import.meta.url)

// Tests never call the India Post or OpenStreetMap lookups.
process.env.CIVICCHAI_GEO_LOOKUPS ??= 'off'
