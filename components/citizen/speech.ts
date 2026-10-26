'use client'

export type SpeechRecognitionLike = {
  lang: string
  interimResults: boolean
  continuous: boolean
  start: () => void
  stop: () => void
  onresult: ((event: any) => void) | null
  onend: (() => void) | null
  onerror: ((event: { error?: string }) => void) | null
  onstart: (() => void) | null
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike

export function getSpeechRecognition(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null
  const browserWindow = window as Window & { SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor }
  return browserWindow.SpeechRecognition ?? browserWindow.webkitSpeechRecognition ?? null
}

/** BCP-47 tag for the browser recognizer and speech synthesis. */
export function speechLanguage(label: string) {
  return label === 'हिन्दी' || label === 'Hindi' ? 'hi-IN' : label === 'मराठी' || label === 'Marathi' ? 'mr-IN' : 'en-IN'
}

/** Explains Web Speech API error codes in plain language. */
export function speechErrorMessage(code?: string) {
  switch (code) {
    case 'not-allowed':
    case 'service-not-allowed':
      return 'Microphone access is blocked. Allow the microphone for this site in your browser settings, then try again.'
    case 'audio-capture':
      return 'No microphone was found. Connect a microphone or type your complaint instead.'
    case 'network':
      return 'Speech recognition needs an internet connection in this browser. Type your complaint, or try again when online.'
    case 'no-speech':
      return 'We did not hear anything. Tap Speak and talk after the listening indicator appears.'
    case 'language-not-supported':
      return 'This browser cannot recognize the selected language. Choose English or type your complaint.'
    case 'aborted':
      return ''
    default:
      return 'Voice recognition stopped. You can correct the transcript or type instead.'
  }
}

export const SPEECH_UNSUPPORTED_MESSAGE = 'Voice input is not supported in this browser. Use Chrome, Edge or Safari, or type your complaint.'

type RecognitionResults = ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>

function mergeSegment(current: string, piece: string) {
  if (!current) return piece
  const existing = current.toLowerCase()
  const next = piece.toLowerCase()
  // Android Chrome re-sends the whole sentence so far as each new result; keep the longer one.
  if (next.startsWith(existing)) return piece
  if (existing.endsWith(next)) return current
  return `${current} ${piece}`
}

/**
 * Rebuilds one recognition session's text from its full result list on every event,
 * instead of appending each event, so updates never write the same words twice.
 */
export function transcriptFromResults(results: RecognitionResults) {
  let finalText = ''
  let interim = ''
  for (let index = 0; index < results.length; index += 1) {
    const piece = results[index][0]?.transcript.trim() ?? ''
    if (!piece) continue
    if (results[index].isFinal) finalText = mergeSegment(finalText, piece)
    else interim = mergeSegment(interim, piece)
  }
  return { finalText, interim }
}

/** Appends a session's transcript to text typed or dictated before the session began. */
export function joinTranscript(before: string, spoken: string) {
  return [before.trim(), spoken.trim()].filter(Boolean).join(' ')
}

// ---- Speaking back (speech synthesis) -----------------------------------------------

// Chrome drops callbacks for utterances that were garbage-collected mid-speech, so keep them.
const speaking = new Set<SpeechSynthesisUtterance>()

// Voice names that are known to be female or male across Chrome, Edge, Safari/macOS,
// Windows and Android. Unknown voices rank between the two.
const FEMALE_VOICE = /female|woman|lekha|kalpana|swara|aarohi|neerja|veena|heera|ananya|aditi|raveena|priya|kajal|isha|shruti|sapna|pallavi|google हिन्दी|google hindi|samantha|karen|moira|tessa|fiona|victoria|zira|aria|jenny|sonia|libby|natasha|serena|kate|susan|allison|ava\b|nicky|zoe/i
const MALE_VOICE = /\bmale\b|rishi|hemant|prabhat|madhur|manohar|ravi\b|daniel|alex\b|fred\b|aaron|arthur|david|mark\b|guy\b|ryan|thomas|oliver|george|prakash|kunal|aarav|valluvar/i

export type VoiceChoice = { voice: SpeechSynthesisVoice | undefined; female: boolean | null; languageMatch: boolean }

/** The best device voice for a language, preferring a female voice. */
export function voiceFor(lang: string): VoiceChoice {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return { voice: undefined, female: null, languageMatch: false }
  const base = lang.slice(0, 2).toLowerCase()
  let best: { voice: SpeechSynthesisVoice; score: number } | undefined
  for (const voice of window.speechSynthesis.getVoices()) {
    const tag = voice.lang.replace('_', '-').toLowerCase()
    // Few devices ship a Marathi voice; a Hindi voice reads the same Devanagari script.
    const language = tag === lang.toLowerCase() ? 6 : tag.startsWith(base) ? 5 : base === 'mr' && tag.startsWith('hi') ? 3 : 0
    if (!language) continue
    const gender = FEMALE_VOICE.test(voice.name) ? 3 : MALE_VOICE.test(voice.name) ? -3 : 0
    const score = language + gender + (/google|natural|online|enhanced|premium/i.test(voice.name) ? 0.5 : 0)
    if (!best || score > best.score) best = { voice, score }
  }
  if (!best) return { voice: undefined, female: null, languageMatch: false }
  return { voice: best.voice, female: FEMALE_VOICE.test(best.voice.name) ? true : MALE_VOICE.test(best.voice.name) ? false : null, languageMatch: true }
}

/** Resolves once the device voice list is available (some browsers load it after a delay). */
export function waitForVoices(timeoutMs = 1500) {
  return new Promise<void>((resolve) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window) || window.speechSynthesis.getVoices().length) { resolve(); return }
    const timer = setTimeout(finish, timeoutMs)
    function finish() {
      clearTimeout(timer)
      window.speechSynthesis.removeEventListener('voiceschanged', finish)
      resolve()
    }
    window.speechSynthesis.addEventListener('voiceschanged', finish)
  })
}

/** Loads the device voices early; some browsers only list them after a first request. */
export function warmUpVoices() {
  try { window.speechSynthesis?.getVoices() } catch { /* no speech synthesis */ }
}

/**
 * Speaks text in a female voice, sentence by sentence (Chrome cuts off long single utterances), and resolves
 * when it has finished or was cancelled. Without speech synthesis it waits roughly as long
 * as reading the caption takes.
 */
export function speakText(text: string, lang: string) {
  return new Promise<void>((resolve) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) { setTimeout(resolve, Math.min(9000, 1200 + text.length * 45)); return }
    const parts = text.split(/(?<=[.!?।])\s+/u).filter(Boolean)
    const { voice, female } = voiceFor(lang)
    let finished = false
    const timer = setTimeout(() => done(), 4000 + text.length * 110)
    function done() {
      if (finished) return
      finished = true
      clearTimeout(timer)
      resolve()
    }
    parts.forEach((part, index) => {
      const utterance = new SpeechSynthesisUtterance(part)
      utterance.lang = voice?.lang ?? lang
      if (voice) utterance.voice = voice
      // CivicChai's agent is a female voice; lift the pitch when only an unknown or male voice exists.
      utterance.pitch = female === true ? 1 : female === null ? 1.1 : 1.25
      speaking.add(utterance)
      utterance.onend = () => { speaking.delete(utterance); if (index === parts.length - 1) done() }
      utterance.onerror = () => { speaking.delete(utterance); done() }
      window.speechSynthesis.speak(utterance)
    })
  })
}

export function stopSpeaking() {
  try { window.speechSynthesis?.cancel() } catch { /* nothing is speaking */ }
}
