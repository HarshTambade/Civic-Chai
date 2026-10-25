// Server-side geocoding. Coordinates are sent to the configured OpenStreetMap
// Nominatim instance and PIN codes to the India Post PIN lookup; both are cached so
// repeat lookups stay within the providers' fair-use policies.

export type ReverseGeocode = {
  pin: string
  locality: string
  city: string
  district: string
  state: string
  label: string
}

export type PincodeInfo = {
  pin: string
  valid: boolean
  district: string
  state: string
  localities: string[]
  center: { latitude: number; longitude: number } | null
}

const NOMINATIM_URL = (process.env.NOMINATIM_URL || 'https://nominatim.openstreetmap.org').replace(/\/$/, '')
const PINCODE_API_URL = (process.env.PINCODE_API_URL || 'https://api.postalpincode.in').replace(/\/$/, '')
const DAY_MS = 24 * 60 * 60 * 1000
const CACHE_KEY = '__civicchai_geo_cache__'

function cache() {
  const root = globalThis as typeof globalThis & { [CACHE_KEY]?: Map<string, { at: number; value: unknown }> }
  root[CACHE_KEY] ??= new Map()
  return root[CACHE_KEY]!
}

async function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
  const store = cache()
  const hit = store.get(key)
  if (hit && Date.now() - hit.at < DAY_MS) return hit.value as T
  const value = await load()
  if (store.size > 1000) store.delete(store.keys().next().value!)
  store.set(key, { at: Date.now(), value })
  return value
}

function userAgent() {
  const site = process.env.NEXT_PUBLIC_SITE_URL || process.env.APP_BASE_URL || 'https://civicchai.local'
  return `CivicChai/1.0 (civic issue reporting; ${site})`
}

async function getJson(url: string) {
  const response = await fetch(url, { headers: { 'User-Agent': userAgent(), 'Accept-Language': 'en-IN,en' }, signal: AbortSignal.timeout(8000) })
  if (!response.ok) throw new Error(`Geocoder responded ${response.status}`)
  return response.json()
}

const str = (value: unknown) => (typeof value === 'string' ? value.trim() : '')

export function isValidCoordinate(latitude: number, longitude: number) {
  return Number.isFinite(latitude) && Number.isFinite(longitude) && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180
}

export async function reverseGeocode(latitude: number, longitude: number): Promise<ReverseGeocode> {
  // ~11 m rounding keeps the cache useful without changing the answer.
  const key = `rev:${latitude.toFixed(4)},${longitude.toFixed(4)}`
  return cached(key, async () => {
    const payload = await getJson(`${NOMINATIM_URL}/reverse?format=jsonv2&addressdetails=1&zoom=18&lat=${latitude}&lon=${longitude}`)
    const address = (payload?.address ?? {}) as Record<string, unknown>
    const pin = str(address.postcode).replace(/\s/g, '')
    const locality = str(address.suburb) || str(address.neighbourhood) || str(address.quarter) || str(address.village) || str(address.hamlet) || str(address.town) || str(address.city_district) || str(address.road)
    return {
      pin: /^\d{6}$/.test(pin) ? pin : '',
      locality,
      city: str(address.city) || str(address.town) || str(address.village) || str(address.county),
      district: str(address.state_district) || str(address.county),
      state: str(address.state),
      label: str(payload?.display_name),
    }
  })
}

export async function lookupPincode(pin: string): Promise<PincodeInfo> {
  return cached(`pin:${pin}`, async () => {
    const [post, place] = await Promise.allSettled([
      getJson(`${PINCODE_API_URL}/pincode/${pin}`),
      getJson(`${NOMINATIM_URL}/search?format=jsonv2&postalcode=${pin}&countrycodes=in&limit=1`),
    ])
    const record = post.status === 'fulfilled' && Array.isArray(post.value) ? post.value[0] : null
    const offices = record?.Status === 'Success' && Array.isArray(record.PostOffice) ? record.PostOffice as Array<Record<string, unknown>> : []
    const first = place.status === 'fulfilled' && Array.isArray(place.value) ? place.value[0] : null
    const latitude = Number(first?.lat)
    const longitude = Number(first?.lon)
    return {
      pin,
      valid: offices.length > 0 || Boolean(first),
      district: str(offices[0]?.District),
      state: str(offices[0]?.State),
      localities: [...new Set(offices.map((office) => str(office.Name)).filter(Boolean))].sort(),
      center: isValidCoordinate(latitude, longitude) ? { latitude, longitude } : null,
    }
  })
}
