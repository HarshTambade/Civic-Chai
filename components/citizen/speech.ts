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
