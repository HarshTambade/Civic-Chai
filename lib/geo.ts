// Server-side geocoding. Coordinates are sent to the configured OpenStreetMap
// Nominatim instance and PIN codes to the India Post PIN lookup; both are cached so
// repeat lookups stay within the providers' fair-use policies.

import { localBodyTypeFrom, type LocalBodyType } from '@/lib/jurisdiction'

export type ReverseGeocode = {
  pin: string
  locality: string
  city: string
  district: string
  /** Taluka / tehsil, when the map knows it. */
  subDistrict: string
  state: string
  /** City and town areas are urban; villages and hamlets are rural. */
  settlement: LocalBodyType
  label: string
}

export type PincodeInfo = {
  pin: string
  valid: boolean
  district: string
  state: string
  localities: string[]
  offices: Array<{ name: string; branchType: string; block: string }>
  /** District and taluka from OpenStreetMap; current where the postal directory predates a district split. */
  map: { district: string; subDistrict: string; state: string }
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

/** "Vasai Subdistrict" → "Vasai", "Palghar District" → "Palghar". */
function areaName(value: unknown) {
  return str(value).replace(/\s+(?:sub-?district|district|taluka|taluk|tehsil|tahsil)$/i, '')
}

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
      district: areaName(address.state_district) || areaName(address.county),
      subDistrict: str(address.state_district) ? areaName(address.county) : '',
      state: str(address.state),
      settlement: str(address.city) || str(address.town) ? 'urban' : str(address.village) || str(address.hamlet) ? 'rural' : 'unknown',
      label: str(payload?.display_name),
    }
  })
}

export async function lookupPincode(pin: string): Promise<PincodeInfo> {
  return cached(`pin-v2:${pin}`, async () => {
    const [post, place] = await Promise.allSettled([
      getJson(`${PINCODE_API_URL}/pincode/${pin}`),
      getJson(`${NOMINATIM_URL}/search?format=jsonv2&addressdetails=1&postalcode=${pin}&countrycodes=in&limit=1`),
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
      map: {
        district: areaName(first?.address?.state_district) || areaName(first?.address?.county),
        subDistrict: first?.address?.state_district ? areaName(first?.address?.county) : '',
        state: str(first?.address?.state),
      },
      offices: offices.map((office) => ({ name: str(office.Name), branchType: str(office.BranchType), block: str(office.Block) })).filter((office) => office.name),
      center: isValidCoordinate(latitude, longitude) ? { latitude, longitude } : null,
    }
  })
}

export type DirectoryArea = { state: string; district: string; subDistrict: string; localBody: string; localBodyType: LocalBodyType }

const AREA_LOOKUP_MS = 3500

/**
 * State, district, taluka and local body for a report, from the India Post PIN directory
 * and (when the reporter shared a location) OpenStreetMap. Not verified by the authority.
 * Filing never waits longer than a few seconds for it; null when nothing is known.
 */
export async function directoryArea(pin: string, locality: string, coordinates?: { latitude: number; longitude: number } | null): Promise<DirectoryArea | null> {
  if (process.env.CIVICCHAI_GEO_LOOKUPS === 'off' || !/^\d{6}$/.test(pin)) return null
  const lookup = Promise.allSettled([
    lookupPincode(pin),
    coordinates && isValidCoordinate(coordinates.latitude, coordinates.longitude) ? reverseGeocode(coordinates.latitude, coordinates.longitude) : Promise.resolve(null),
  ])
  const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), AREA_LOOKUP_MS))
  const settled = await Promise.race([lookup, timeout])
  if (!settled) return null
  const post = settled[0].status === 'fulfilled' ? settled[0].value : null
  const map = settled[1].status === 'fulfilled' ? settled[1].value : null
  // The map's answer only counts when it agrees with the reported PIN.
  const place = map && (!map.pin || map.pin === pin) ? map : null
  const offices = post?.offices ?? []
  const lower = locality.trim().toLowerCase()
  const office = offices.find((item) => lower && (item.name.toLowerCase() === lower || lower.includes(item.name.toLowerCase()))) ?? offices[0]
  const block = office?.block && !/^(na|n\.a\.|-)$/i.test(office.block) ? office.block : ''
  // OpenStreetMap is preferred for district and taluka: the postal directory still lists
  // some areas under their old district (Palghar PINs under Thane, for example).
  const area = {
    state: place?.state || post?.map?.state || post?.state || '',
    district: place?.district || post?.map?.district || post?.district || '',
    subDistrict: place?.subDistrict || post?.map?.subDistrict || block,
    localBody: place?.settlement !== 'unknown' ? place?.city ?? '' : '',
    localBodyType: localBodyTypeFrom({ mapSettlement: place?.settlement, locality, offices }),
  }
  return area.state || area.district ? area : null
}
