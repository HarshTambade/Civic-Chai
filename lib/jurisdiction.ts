// Which level of government is responsible for a civic complaint, following the
// Constitution of India's division of subjects: the Seventh Schedule (Union, State and
// Concurrent Lists) and the Eleventh and Twelfth Schedules for panchayats and municipalities.
// It is a routing suggestion shown with its basis; State laws decide what is actually
// devolved to a local body, and the authority confirms the owner.

export type GovernanceLevel = 'union' | 'state' | 'local'
export type LocalBodyType = 'urban' | 'rural' | 'unknown'

export type JurisdictionAssessment = {
  level: GovernanceLevel
  levelLabel: string
  authority: string
  basis: string
  reason: string
  ruleId: string
}

type Override = Omit<JurisdictionAssessment, 'levelLabel'> & { words: RegExp }

const LEVEL_LABEL: Record<GovernanceLevel, string> = {
  union: 'Union (Central) government',
  state: 'State government',
  local: 'Local body',
}

// Street lighting is a municipal amenity even when the complaint mentions wires or poles.
const STREETLIGHT = /street.?lights?|street ?lamps?|lamp ?posts?|स्ट्रीट ?लाइट|पथदीप|पथदिवे|दिवे बंद|बत्ती/iu

const OVERRIDES: Override[] = [
  {
    ruleId: 'national-highway', level: 'union',
    words: /national highway|\bNH[- ]?\d{1,3}[A-Z]?\b|\bNHAI\b|राष्ट्रीय राजमार्ग|राष्ट्रीय महामार्ग/iu,
    authority: 'National Highways Authority of India (Ministry of Road Transport and Highways)',
    basis: 'Constitution of India, Seventh Schedule, Union List: highways declared by Parliament to be national highways.',
    reason: 'The complaint mentions a national highway.',
  },
  {
    ruleId: 'railways', level: 'union',
    words: /railway|rail track|railway station|railway platform|level crossing|local train|रेलवे|रेल्वे|रेल की पटरी|प्लेटफ़ॉर्म|प्लेटफॉर्म|फलाट/iu,
    authority: 'Indian Railways (zonal railway / divisional office)',
    basis: 'Constitution of India, Seventh Schedule, Union List: railways.',
    reason: 'The complaint is about railway property or services.',
  },
  {
    ruleId: 'posts-telecom', level: 'union',
    words: /post office|postal|letter ?box|\bBSNL\b|mobile tower|telephone (?:line|exchange)|डाकघर|पोस्ट ऑफिस|टपाल|मोबाइल टॉवर/iu,
    authority: 'Department of Posts / Department of Telecommunications',
    basis: 'Constitution of India, Seventh Schedule, Union List: posts and telegraphs, telephones and other like forms of communication.',
    reason: 'The complaint is about a postal or telecom service.',
  },
  {
    ruleId: 'state-highway', level: 'state',
    words: /state highway|\bSH[- ]?\d{1,3}\b|राज्य राजमार्ग|राज्य महामार्ग/iu,
    authority: 'State Public Works Department',
    basis: 'Constitution of India, Seventh Schedule, State List: roads, bridges and other means of communication not in the Union List.',
    reason: 'The complaint mentions a state highway.',
  },
  {
    ruleId: 'electricity', level: 'state',
    words: /power cut|power outage|no electricity|electricity supply|transformer|live wire|electric (?:pole|wire|meter)|low voltage|bijli|light (?:nahi|gayi)|\bDISCOM\b|MSEDCL|\bMSEB\b|बिजली|वीज|लाईट गेली|लाइट गई|ट्रान्सफॉर्मर|ट्रांसफार्मर/iu,
    authority: 'State electricity distribution company (DISCOM)',
    basis: "Constitution of India, Seventh Schedule, Concurrent List: electricity. Household supply is run by the State's distribution company.",
    reason: 'The complaint is about mains electricity supply, not street lighting.',
  },
]

// Twelfth Schedule (municipalities) and Eleventh Schedule (panchayats) subjects per category.
const LOCAL_SUBJECTS: Record<string, { urban: string; rural: string }> = {
  'Public Lighting': { urban: 'public amenities including street lighting', rural: 'maintenance of community assets' },
  Sanitation: { urban: 'public health, sanitation conservancy and solid waste management', rural: 'health and sanitation' },
  'Roads & Potholes': { urban: 'roads and bridges', rural: 'roads, culverts, bridges, ferries, waterways and other means of communication' },
  'Water Supply': { urban: 'water supply for domestic, industrial and commercial purposes', rural: 'drinking water' },
  Drainage: { urban: 'public health, sanitation conservancy and solid waste management', rural: 'health and sanitation' },
  'Public Health': { urban: 'public health, sanitation conservancy and solid waste management', rural: 'health and sanitation, including hospitals, primary health centres and dispensaries' },
  'General civic issue': { urban: 'the civic functions listed in the schedule', rural: 'maintenance of community assets' },
}

const LOCAL_AUTHORITY: Record<LocalBodyType, { label: string; authority: string }> = {
  urban: { label: 'Urban local body', authority: 'Municipal corporation, municipal council or nagar panchayat' },
  rural: { label: 'Rural local body (Panchayati Raj)', authority: 'Gram panchayat, with the panchayat samiti and zilla parishad' },
  unknown: { label: 'Local body', authority: 'Municipality (urban areas) or gram panchayat (rural areas)' },
}

function localBasis(category: string, type: LocalBodyType) {
  const subject = LOCAL_SUBJECTS[category] ?? LOCAL_SUBJECTS['General civic issue']
  const urban = `Twelfth Schedule (Article 243W): ${subject.urban}`
  const rural = `Eleventh Schedule (Article 243G): ${subject.rural}`
  const schedules = type === 'urban' ? urban : type === 'rural' ? rural : `${urban}; ${rural}`
  return `Constitution of India, ${schedules}. What is devolved to the local body depends on State law.`
}

/** Suggests the responsible level of government for a complaint, with the reason and basis. */
export function assessJurisdiction(input: { text: string; category: string; localBodyType?: LocalBodyType }): JurisdictionAssessment {
  const text = input.text ?? ''
  const type = input.localBodyType ?? 'unknown'
  const streetlight = input.category === 'Public Lighting' || STREETLIGHT.test(text)
  const override = OVERRIDES.find((rule) => !(rule.ruleId === 'electricity' && streetlight) && rule.words.test(text))
  if (override) {
    const { words: _words, ...rest } = override
    return { ...rest, levelLabel: LEVEL_LABEL[rest.level] }
  }
  if (input.category === 'Traffic') {
    return {
      ruleId: 'traffic', level: 'state', levelLabel: LEVEL_LABEL.state,
      authority: 'Traffic police (State police), with the road-owning agency for signals and markings',
      basis: 'Constitution of India, Seventh Schedule, State List: police.',
      reason: 'Traffic and road-safety enforcement is a police function.',
    }
  }
  const local = LOCAL_AUTHORITY[type]
  return {
    ruleId: `local-${type}`, level: 'local', levelLabel: local.label,
    authority: local.authority,
    basis: localBasis(input.category, type),
    reason: type === 'unknown' ? 'A municipal civic service; whether the area is urban or rural is not yet known.' : `A municipal civic service in a ${type} area.`,
  }
}

/** Urban or rural, from the post office that serves the locality and the map's place type. */
export function localBodyTypeFrom(input: { mapSettlement?: LocalBodyType; locality?: string; offices?: Array<{ name: string; branchType: string }> }): LocalBodyType {
  if (input.mapSettlement && input.mapSettlement !== 'unknown') return input.mapSettlement
  const offices = input.offices ?? []
  const locality = (input.locality ?? '').trim().toLowerCase()
  const match = locality ? offices.find((office) => {
    const name = office.name.toLowerCase()
    return name === locality || locality.includes(name) || name.includes(locality)
  }) : undefined
  // Branch post offices serve villages; head offices sit in towns and cities.
  if (match?.branchType === 'Branch Post Office') return 'rural'
  if (match?.branchType === 'Head Post Office') return 'urban'
  if (offices.length && offices.every((office) => office.branchType === 'Branch Post Office')) return 'rural'
  return 'unknown'
}

/** The administrative path shown on reports: State › District › Taluka › Local body › Ward › PIN. */
export function adminPath(issue: { state?: string; district?: string; subDistrict?: string; municipality?: string; ward?: string; pin: string }) {
  return [issue.state, issue.district, issue.subDistrict, issue.municipality, issue.ward, `PIN ${issue.pin}`].filter((part): part is string => Boolean(part && part.trim()))
}
