'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { SiteNav } from '@/components/landing/site-nav'
import { SiteFooter } from '@/components/landing/site-footer'
import { useAuth } from '@/components/auth-provider'
import { useLanguage } from '@/components/language-provider'
import { useServiceArea } from '@/components/citizen/use-service-area'
import { locationAlreadyAllowed, useLiveLocation } from '@/components/citizen/use-location'
import { getSpeechRecognition, speakText, speechErrorMessage, stopSpeaking, transcriptFromResults, voiceFor, waitForVoices, warmUpVoices, type SpeechRecognitionLike } from '@/components/citizen/speech'
import { haptic } from '@/components/haptics'
import { analyzeComplaint, analyzeComplaintRequest, type ComplaintAnalysis } from '@/lib/ai'
import { civicFetch, submitIssuePayload, withdrawIssueRequest } from '@/lib/client-api'
import { saveOfflineDraft } from '@/lib/offline-queue'
import {
  afterClassify, afterDraftSaved, afterFileFailed, afterFiled, afterWithdrawFailed, afterWithdrawn, awaitingCaller, currentQuestion,
  handleDigits, handleReply, handleSilence, startCall, withCoverage, withDetectedLocation,
  type CallLanguage, type CallSlots, type CallStage, type CallState, type CallTurn,
} from '@/lib/voice-call'
import type { IssueRecord } from '@/lib/types'
import { ArrowLeft, Captions, CaptionsOff, Check, Coffee, Delete, Grid3x3, MapPin, Mic, MicOff, Phone, PhoneOff, RefreshCw, Repeat2, Send, Undo2, Volume2, VolumeX } from 'lucide-react'

type Phase = 'idle' | 'ringing' | 'connected' | 'ended'
type Activity = 'speaking' | 'listening' | 'thinking' | 'waiting'
type Line = { who: 'agent' | 'caller'; text: string }
type Withdrawal = { outcome: 'deleted' | 'withdrawn'; documentId: string }

const LANGUAGES: Array<{ code: CallLanguage; label: string; tag: string; name: string }> = [
  { code: 'en', label: 'English', tag: 'en-IN', name: 'English' },
  { code: 'hi', label: 'हिन्दी', tag: 'hi-IN', name: 'Hindi' },
  { code: 'mr', label: 'मराठी', tag: 'mr-IN', name: 'Marathi' },
]
const languageOf = (code: CallLanguage) => LANGUAGES.find((item) => item.code === code) ?? LANGUAGES[0]

// The call screen speaks the caller's language, not just the agent.
const UI = {
  en: {
    kicker: 'Voice-first filing · SOP calling agent',
    title: 'Just call. Talk. Done.',
    intro: 'Call the CivicChai agent and say what is wrong, in English, Hindi or Marathi. She asks where, for how long and whether you have proof, reads the complaint back, and files it only when you say yes. Then she reads your report ID aloud.',
    steps: ['Tell the problem in your own words', 'Confirm the place and PIN', 'Say how long, and if you have proof', 'Hear it read back and say yes', 'Get your report ID'],
    note: 'This demo call runs in your browser. A real toll-free number needs an authority-assigned line and a telephony provider; the same agent script then runs on the phone line.',
    helpline: 'CivicChai Helpline', line: 'Neighbourhood complaint line', badge: 'AI agent · demo call',
    consentSpeech: 'My browser may turn my speech into text. No audio is uploaded or kept.',
    consentLocation: 'Share my location so the agent can find the PIN.',
    consentCloud: 'Let cloud AI classify my complaint text (optional; otherwise on-site rules are used).',
    noRecognition: 'This browser cannot hear speech. The agent still talks; answer by typing or with the keypad. Chrome or Edge can hear you.',
    tapToCall: 'Tap to call', youAre: (handle: string) => `you are ${handle}`, signIn: 'Sign in to call',
    ringing: 'Ringing…', connecting: 'Connecting you to the CivicChai agent…', locating: 'Finding your location…',
    speaking: 'CivicChai is speaking', listening: 'Listening… take your time', understanding: 'Understanding…', filing: 'Filing your report…', withdrawing: 'Taking it back…',
    yourTurnType: 'Your turn: type or use the keypad', yourTurnMic: 'Your turn: tap the mic to talk',
    ended: (time: string) => `Call ended · ${time}`,
    checklist: ['Problem', 'Place', 'PIN', 'How long', 'Proof', 'Filed'],
    typePlaceholder: 'Or type your answer', send: 'Send answer',
    mute: 'Mute', unmute: 'Unmute', keypad: 'Keypad', speaker: 'Speaker', repeat: 'Repeat', captions: 'Captions', restart: 'Start over', end: 'End call', hide: 'Hide', back: 'Back', del: 'Delete digit',
    tapToTalk: 'Tap to talk', doneSpeaking: "I'm done speaking", interrupt: 'Interrupt and answer', speakerOff: 'Speaker off · captions only', captionsOff: 'Captions are hidden',
    keypadPin: 'Type the 6-digit PIN', keypadYesNo: '1 = yes · 2 = no', keypadHelp: '# sends · * clears',
    filed: 'Report filed', routed: (department: string) => `Routed to ${department}`, openReport: 'Open report', myCharcha: 'My Charcha',
    noReport: 'No report was filed on this call.', draftSaved: 'Your complaint is saved on this device as a draft. It is sent when you reconnect.',
    transcript: (count: number) => `Call transcript (${count} lines)`, agent: 'Agent', you: 'You', callAgain: 'Call again',
    takeBack: 'Take back this complaint', confirmTakeBack: 'Tap again to confirm', takingBack: 'Taking back…', takenBack: 'Complaint taken back', deletedMsg: (id: string) => `${id} is deleted.`, withdrawnMsg: (id: string) => `${id} is withdrawn. It is no longer public and the authority will not act on it.`,
    preferForm: 'Prefer filling it in yourself?', formLink: 'Use the step-by-step voice form',
    noVoice: (name: string) => `This device has no ${name} voice, so what CivicChai says is shown as captions. Install a ${name} voice in your phone's text-to-speech settings to hear her.`,
    names: { en: 'English', hi: 'Hindi', mr: 'Marathi' },
  },
  hi: {
    kicker: 'आवाज़ से शिकायत · SOP कॉलिंग एजेंट',
    title: 'बस कॉल करें। बोलें। हो गया।',
    intro: 'CivicChai एजेंट को कॉल करें और हिन्दी, मराठी या अंग्रेज़ी में बताइए कि क्या ख़राब है। वह पूछेगी कि कहाँ, कब से, और क्या आपके पास सबूत है; फिर शिकायत पढ़कर सुनाएगी और आपके "हाँ" कहने पर ही दर्ज करेगी। उसके बाद आपकी रिपोर्ट आईडी बोलकर बताएगी।',
    steps: ['अपने शब्दों में समस्या बताइए', 'जगह और पिन पक्का कीजिए', 'बताइए कब से है, और सबूत है या नहीं', 'शिकायत सुनिए और "हाँ" कहिए', 'अपनी रिपोर्ट आईडी पाइए'],
    note: 'यह डेमो कॉल आपके ब्राउज़र में चलती है। असली टोल-फ़्री नंबर के लिए प्राधिकरण का नंबर और टेलीफ़ोनी प्रदाता चाहिए; तब यही एजेंट फ़ोन लाइन पर चलेगी।',
    helpline: 'CivicChai हेल्पलाइन', line: 'मोहल्ले की शिकायत लाइन', badge: 'AI एजेंट · डेमो कॉल',
    consentSpeech: 'मेरा ब्राउज़र मेरी आवाज़ को टेक्स्ट में बदल सकता है। कोई ऑडियो अपलोड या सेव नहीं होता।',
    consentLocation: 'मेरी लोकेशन शेयर करें ताकि एजेंट पिन ढूँढ सके।',
    consentCloud: 'क्लाउड AI को मेरी शिकायत का टेक्स्ट समझने दें (वैकल्पिक; वरना साइट के नियम इस्तेमाल होंगे)।',
    noRecognition: 'यह ब्राउज़र आवाज़ नहीं सुन सकता। एजेंट बोलेगी; आप टाइप करके या कीपैड से जवाब दे सकते हैं। Chrome या Edge में आवाज़ सुनी जा सकती है।',
    tapToCall: 'कॉल करने के लिए दबाएँ', youAre: (handle: string) => `आप ${handle} हैं`, signIn: 'कॉल करने के लिए साइन इन करें',
    ringing: 'घंटी बज रही है…', connecting: 'CivicChai एजेंट से जोड़ा जा रहा है…', locating: 'आपकी लोकेशन ढूँढी जा रही है…',
    speaking: 'CivicChai बोल रही है', listening: 'सुन रही है… आराम से बोलिए', understanding: 'समझ रही है…', filing: 'रिपोर्ट दर्ज हो रही है…', withdrawing: 'शिकायत वापस ली जा रही है…',
    yourTurnType: 'आपकी बारी: टाइप करें या कीपैड इस्तेमाल करें', yourTurnMic: 'आपकी बारी: बोलने के लिए माइक दबाएँ',
    ended: (time: string) => `कॉल ख़त्म · ${time}`,
    checklist: ['समस्या', 'जगह', 'पिन', 'कब से', 'सबूत', 'दर्ज'],
    typePlaceholder: 'या अपना जवाब टाइप करें', send: 'जवाब भेजें',
    mute: 'म्यूट', unmute: 'अनम्यूट', keypad: 'कीपैड', speaker: 'स्पीकर', repeat: 'दोहराएँ', captions: 'कैप्शन', restart: 'फिर से शुरू', end: 'कॉल काटें', hide: 'छिपाएँ', back: 'वापस', del: 'अंक मिटाएँ',
    tapToTalk: 'बोलने के लिए दबाएँ', doneSpeaking: 'मेरी बात पूरी हुई', interrupt: 'बीच में रोककर जवाब दें', speakerOff: 'स्पीकर बंद · सिर्फ़ कैप्शन', captionsOff: 'कैप्शन छिपे हैं',
    keypadPin: '6 अंकों का पिन दबाएँ', keypadYesNo: '1 = हाँ · 2 = ना', keypadHelp: '# भेजें · * मिटाएँ',
    filed: 'रिपोर्ट दर्ज हुई', routed: (department: string) => `विभाग: ${department}`, openReport: 'रिपोर्ट खोलें', myCharcha: 'My Charcha',
    noReport: 'इस कॉल में कोई रिपोर्ट दर्ज नहीं हुई।', draftSaved: 'आपकी शिकायत इसी डिवाइस पर ड्राफ़्ट के रूप में सहेजी गई है। इंटरनेट आते ही भेज दी जाएगी।',
    transcript: (count: number) => `कॉल का लिखित रूप (${count} पंक्तियाँ)`, agent: 'एजेंट', you: 'आप', callAgain: 'फिर से कॉल करें',
    takeBack: 'यह शिकायत वापस लें', confirmTakeBack: 'पक्का करने के लिए फिर दबाएँ', takingBack: 'वापस ली जा रही है…', takenBack: 'शिकायत वापस ली गई', deletedMsg: (id: string) => `${id} हटा दी गई है।`, withdrawnMsg: (id: string) => `${id} वापस ले ली गई है। अब यह सार्वजनिक नहीं है और इस पर कार्रवाई नहीं होगी।`,
    preferForm: 'ख़ुद भरना पसंद है?', formLink: 'चरण-दर-चरण वॉइस फ़ॉर्म इस्तेमाल करें',
    noVoice: (name: string) => `इस डिवाइस में ${name} आवाज़ नहीं है, इसलिए CivicChai की बातें कैप्शन में दिखेंगी। उसे सुनने के लिए फ़ोन की टेक्स्ट-टू-स्पीच सेटिंग में ${name} आवाज़ इंस्टॉल करें।`,
    names: { en: 'अंग्रेज़ी', hi: 'हिन्दी', mr: 'मराठी' },
  },
  mr: {
    kicker: 'आवाजाने तक्रार · SOP कॉलिंग एजंट',
    title: 'फक्त कॉल करा. बोला. झालं.',
    intro: 'CivicChai एजंटला कॉल करा आणि मराठी, हिंदी किंवा इंग्रजीत काय बिघडलं ते सांगा. ती विचारेल कुठे, किती दिवसांपासून आणि पुरावा आहे का; मग तक्रार वाचून दाखवेल आणि तुम्ही "हो" म्हटल्यावरच नोंदवेल. नंतर तुमचा रिपोर्ट आयडी बोलून सांगेल.',
    steps: ['तुमच्या शब्दांत समस्या सांगा', 'ठिकाण आणि पिन निश्चित करा', 'किती दिवसांपासून आणि पुरावा आहे का ते सांगा', 'तक्रार ऐका आणि "हो" म्हणा', 'तुमचा रिपोर्ट आयडी मिळवा'],
    note: 'हा डेमो कॉल तुमच्या ब्राउझरमध्ये चालतो. खऱ्या टोल-फ्री नंबरसाठी प्राधिकरणाचा नंबर आणि टेलिफोनी प्रदाता लागतो; तेव्हा हीच एजंट फोन लाईनवर चालेल.',
    helpline: 'CivicChai हेल्पलाईन', line: 'परिसरातील तक्रार लाईन', badge: 'AI एजंट · डेमो कॉल',
    consentSpeech: 'माझा ब्राउझर माझा आवाज मजकुरात बदलू शकतो. कोणताही ऑडिओ अपलोड किंवा जतन होत नाही.',
    consentLocation: 'माझे लोकेशन शेअर करा, म्हणजे एजंटला पिन सापडेल.',
    consentCloud: 'क्लाउड AI ला माझ्या तक्रारीचा मजकूर समजू द्या (ऐच्छिक; नाहीतर साइटचे नियम वापरले जातील).',
    noRecognition: 'हा ब्राउझर आवाज ऐकू शकत नाही. एजंट बोलेल; तुम्ही टाइप करून किंवा कीपॅडने उत्तर देऊ शकता. Chrome किंवा Edge मध्ये आवाज ऐकला जातो.',
    tapToCall: 'कॉल करण्यासाठी दाबा', youAre: (handle: string) => `तुम्ही ${handle} आहात`, signIn: 'कॉल करण्यासाठी साइन इन करा',
    ringing: 'रिंग वाजत आहे…', connecting: 'CivicChai एजंटशी जोडत आहे…', locating: 'तुमचे लोकेशन शोधत आहे…',
    speaking: 'CivicChai बोलत आहे', listening: 'ऐकत आहे… सावकाश बोला', understanding: 'समजून घेत आहे…', filing: 'रिपोर्ट नोंदवत आहे…', withdrawing: 'तक्रार मागे घेत आहे…',
    yourTurnType: 'तुमची पाळी: टाइप करा किंवा कीपॅड वापरा', yourTurnMic: 'तुमची पाळी: बोलण्यासाठी माइक दाबा',
    ended: (time: string) => `कॉल संपला · ${time}`,
    checklist: ['समस्या', 'ठिकाण', 'पिन', 'किती दिवस', 'पुरावा', 'नोंदवली'],
    typePlaceholder: 'किंवा तुमचं उत्तर टाइप करा', send: 'उत्तर पाठवा',
    mute: 'म्यूट', unmute: 'अनम्यूट', keypad: 'कीपॅड', speaker: 'स्पीकर', repeat: 'पुन्हा ऐका', captions: 'कॅप्शन', restart: 'पुन्हा सुरू', end: 'कॉल बंद करा', hide: 'लपवा', back: 'मागे', del: 'अंक खोडा',
    tapToTalk: 'बोलण्यासाठी दाबा', doneSpeaking: 'माझं बोलणं झालं', interrupt: 'मध्येच थांबवून उत्तर द्या', speakerOff: 'स्पीकर बंद · फक्त कॅप्शन', captionsOff: 'कॅप्शन लपवले आहेत',
    keypadPin: '6 अंकी पिन दाबा', keypadYesNo: '1 = हो · 2 = नाही', keypadHelp: '# पाठवा · * खोडा',
    filed: 'रिपोर्ट नोंदवला', routed: (department: string) => `विभाग: ${department}`, openReport: 'रिपोर्ट उघडा', myCharcha: 'My Charcha',
    noReport: 'या कॉलमध्ये कोणताही रिपोर्ट नोंदवला नाही.', draftSaved: 'तुमची तक्रार याच डिव्हाइसवर ड्राफ्ट म्हणून जतन केली आहे. इंटरनेट मिळताच ती पाठवली जाईल.',
    transcript: (count: number) => `कॉलचा लिखित मजकूर (${count} ओळी)`, agent: 'एजंट', you: 'तुम्ही', callAgain: 'पुन्हा कॉल करा',
    takeBack: 'ही तक्रार मागे घ्या', confirmTakeBack: 'निश्चित करण्यासाठी पुन्हा दाबा', takingBack: 'मागे घेत आहे…', takenBack: 'तक्रार मागे घेतली', deletedMsg: (id: string) => `${id} काढून टाकली आहे.`, withdrawnMsg: (id: string) => `${id} मागे घेतली आहे. ती आता सार्वजनिक नाही आणि त्यावर कारवाई होणार नाही.`,
    preferForm: 'स्वतः भरायला आवडेल?', formLink: 'टप्प्याटप्प्याचा व्हॉइस फॉर्म वापरा',
    noVoice: (name: string) => `या डिव्हाइसवर ${name} आवाज नाही, त्यामुळे CivicChai चं बोलणं कॅप्शनमध्ये दिसेल. तिचा आवाज ऐकण्यासाठी फोनच्या टेक्स्ट-टू-स्पीच सेटिंगमध्ये ${name} आवाज इन्स्टॉल करा.`,
    names: { en: 'इंग्रजी', hi: 'हिंदी', mr: 'मराठी' },
  },
} satisfies Record<CallLanguage, unknown>

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#']
const DTMF: Record<string, [number, number]> = {
  '1': [697, 1209], '2': [697, 1336], '3': [697, 1477], '4': [770, 1209], '5': [770, 1336], '6': [770, 1477],
  '7': [852, 1209], '8': [852, 1336], '9': [852, 1477], '*': [941, 1209], '0': [941, 1336], '#': [941, 1477],
}

const RING_SECONDS = 3.6
// The caller's turn ends after this much silence. Describing the problem gets the longest
// pause, so people can stop and think mid-sentence; yes/no answers end sooner.
const SILENCE_MS: Partial<Record<CallStage, number>> = { problem: 3500, location: 2800, change: 2800, duration: 2500 }
const DEFAULT_SILENCE_MS = 2000
const MAX_TURN_MS = 90_000
// After this many unanswered prompts in a row the agent stops opening the microphone on its own.
const MAX_AUTO_LISTEN_MISSES = 3

function tone(context: AudioContext | null, frequencies: number[], start: number, length: number, volume = 0.06) {
  if (!context) return
  const gain = context.createGain()
  gain.gain.setValueAtTime(volume, context.currentTime + start)
  gain.gain.setValueAtTime(0, context.currentTime + start + length)
  gain.connect(context.destination)
  for (const frequency of frequencies) {
    const oscillator = context.createOscillator()
    oscillator.frequency.value = frequency
    oscillator.connect(gain)
    oscillator.start(context.currentTime + start)
    oscillator.stop(context.currentTime + start + length + 0.05)
  }
}

/** Indian ringback: two 0.4 s bursts of 400 + 450 Hz, then a pause. */
function ringback(context: AudioContext | null) {
  for (const cycle of [0, 2]) {
    tone(context, [400, 450], cycle + 0.1, 0.4)
    tone(context, [400, 450], cycle + 0.7, 0.4)
  }
}

function clock(seconds: number) {
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function CallButton({ label, onClick, active = false, disabled = false, children }: { label: string; onClick: () => void; active?: boolean; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-pressed={active} className="flex flex-col items-center gap-1 text-[11px] text-cream/70 disabled:opacity-35">
      <span className={`flex h-12 w-12 items-center justify-center rounded-full transition active:scale-95 ${active ? 'bg-cream text-charcoal' : 'bg-cream/10'}`}>{children}</span>
      {label}
    </button>
  )
}

export function VoiceCall() {
  const router = useRouter()
  const { user, isHydrated } = useAuth()
  const { language: siteLanguage } = useLanguage()
  const area = useServiceArea()
  const live = useLiveLocation()

  const [phase, setPhase] = useState<Phase>('idle')
  const [language, setLanguage] = useState<CallLanguage>('en')
  const [voiceConsent, setVoiceConsent] = useState(true)
  const [shareLocation, setShareLocation] = useState(false)
  const [cloudAi, setCloudAi] = useState(false)
  const [speechSupported, setSpeechSupported] = useState(true)

  const [lines, setLines] = useState<Line[]>([])
  const [interim, setInterim] = useState('')
  const [activity, setActivity] = useState<Activity>('waiting')
  const [stage, setStage] = useState<CallStage>('problem')
  const [slots, setSlots] = useState<CallSlots | null>(null)
  const [settled, setSettled] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [muted, setMuted] = useState(false)
  const [speakerOn, setSpeakerOn] = useState(true)
  const [captionsOn, setCaptionsOn] = useState(true)
  const [keypadOpen, setKeypadOpen] = useState(false)
  const [keyBuffer, setKeyBuffer] = useState('')
  const [typed, setTyped] = useState('')
  const [notice, setNotice] = useState('')
  const [issue, setIssue] = useState<IssueRecord | null>(null)
  const [pendingDraft, setPendingDraft] = useState(false)
  const [withdrawal, setWithdrawal] = useState<Withdrawal | null>(null)
  const [confirmTakeBack, setConfirmTakeBack] = useState(false)
  const [takeBackBusy, setTakeBackBusy] = useState(false)
  const [takeBackError, setTakeBackError] = useState('')

  // Speech and timer callbacks outlive renders, so the live call lives in refs.
  const callRef = useRef<CallState | null>(null)
  const phaseRef = useRef<Phase>('idle')
  const mutedRef = useRef(false)
  const speakerRef = useRef(true)
  const turnRef = useRef(0)
  const sessionRef = useRef(0)
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const finishTurnRef = useRef<(() => void) | null>(null)
  const audioRef = useRef<AudioContext | null>(null)
  const sourceRef = useRef<AudioBufferSourceNode | null>(null)
  const cloudVoiceRef = useRef(false)
  const analysisRef = useRef<ComplaintAnalysis | null>(null)
  const issueRef = useRef<IssueRecord | null>(null)
  const detectedRef = useRef<CallState['detected']>(null)
  const coordsRef = useRef<{ latitude: number; longitude: number } | null>(null)
  const coverageRef = useRef<Record<string, boolean | null>>({})
  const captionsRef = useRef<HTMLDivElement | null>(null)
  const optionsRef = useRef({ voiceConsent, cloudAi, offline: false })
  optionsRef.current = { voiceConsent, cloudAi, offline: area.consent.offline_storage }

  const ui = UI[language]

  useEffect(() => {
    setSpeechSupported(Boolean(getSpeechRecognition()))
    warmUpVoices()
    void locationAlreadyAllowed().then((allowed) => { if (allowed) setShareLocation(true) })
    void fetch('/api/voice/tts', { cache: 'no-store' }).then((response) => response.ok ? response.json() : null).then((payload) => { cloudVoiceRef.current = payload?.enabled === true }).catch(() => undefined)
    return () => {
      phaseRef.current = 'ended'
      sessionRef.current += 1
      try { recognitionRef.current?.stop() } catch { /* already stopped */ }
      stopSpeaking()
      try { sourceRef.current?.stop() } catch { /* not playing */ }
      void audioRef.current?.close().catch(() => undefined)
    }
  }, [])

  // The call starts in the language the site is shown in.
  useEffect(() => {
    if (phaseRef.current === 'idle' && (siteLanguage === 'en' || siteLanguage === 'hi' || siteLanguage === 'mr')) setLanguage(siteLanguage)
  }, [siteLanguage])

  useEffect(() => {
    if (phase !== 'connected') return
    const timer = setInterval(() => setSeconds((value) => value + 1), 1000)
    return () => clearInterval(timer)
  }, [phase])

  useEffect(() => {
    captionsRef.current?.scrollTo({ top: captionsRef.current.scrollHeight, behavior: 'smooth' })
  }, [lines, interim, captionsOn, keypadOpen])

  function addLine(line: Line) {
    setLines((current) => [...current, line])
  }

  function setCall(state: CallState) {
    callRef.current = state
    setStage(state.stage)
    setSlots(state.slots)
    setSettled(state.locationSettled)
  }

  async function coverage(pin: string) {
    if (!/^\d{6}$/.test(pin)) return null
    if (pin in coverageRef.current) return coverageRef.current[pin]
    try {
      const response = await fetch(`/api/coverage?pin=${pin}`)
      const payload = response.ok ? await response.json() : null
      coverageRef.current[pin] = typeof payload?.covered === 'boolean' ? payload.covered : null
    } catch {
      coverageRef.current[pin] = null
    }
    return coverageRef.current[pin]
  }

  // ---- The agent's voice -------------------------------------------------------------

  function stopVoice() {
    stopSpeaking()
    try { sourceRef.current?.stop() } catch { /* not playing */ }
    sourceRef.current = null
  }

  /** Plays the configured cloud voice (a natural female voice in every call language). */
  async function playCloudVoice(text: string, code: CallLanguage) {
    const context = audioRef.current
    if (!context) return false
    const response = await civicFetch('/api/voice/tts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, language: code }) })
    if (!response.ok) return false
    const buffer = await context.decodeAudioData(await response.arrayBuffer())
    await new Promise<void>((resolve) => {
      const source = context.createBufferSource()
      source.buffer = buffer
      source.connect(context.destination)
      const timer = setTimeout(finish, buffer.duration * 1000 + 1500)
      function finish() {
        clearTimeout(timer)
        if (sourceRef.current === source) sourceRef.current = null
        resolve()
      }
      source.onended = finish
      sourceRef.current = source
      source.start()
    })
    return true
  }

  async function voice(text: string, code: CallLanguage) {
    if (!speakerRef.current) { await wait(700 + text.length * 30); return }
    if (cloudVoiceRef.current) {
      try { if (await playCloudVoice(text, code)) return } catch { /* fall back to the device voice */ }
    }
    await speakText(text, languageOf(code).tag)
  }

  // ---- Listening --------------------------------------------------------------------

  function stopListening() {
    sessionRef.current += 1
    finishTurnRef.current = null
    try { recognitionRef.current?.stop() } catch { /* already stopped */ }
    recognitionRef.current = null
    setInterim('')
  }

  /** The caller says they are done; whatever was heard is used straight away. */
  function doneSpeaking() {
    haptic('tap')
    finishTurnRef.current?.()
  }

  function listen() {
    const call = callRef.current
    if (phaseRef.current !== 'connected' || !call || !awaitingCaller(call)) return
    const Recognition = getSpeechRecognition()
    if (mutedRef.current || !Recognition || !optionsRef.current.voiceConsent) { setActivity('waiting'); return }
    stopListening()
    setActivity('listening')
    const session = sessionRef.current
    const recognition = new Recognition()
    recognition.lang = languageOf(call.language).tag
    recognition.interimResults = true
    // Keep listening through short pauses; the turn ends after a real silence (below).
    recognition.continuous = true
    let finalText = ''
    let partial = ''
    let failed = false
    let finished = false
    let silenceTimer: ReturnType<typeof setTimeout> | undefined
    const silenceMs = SILENCE_MS[call.stage] ?? DEFAULT_SILENCE_MS
    const maxTimer = setTimeout(() => finish(), MAX_TURN_MS)
    const heard = () => [finalText, partial].filter(Boolean).join(' ').trim()

    function finish() {
      if (finished || session !== sessionRef.current) return
      finished = true
      clearTimeout(silenceTimer)
      clearTimeout(maxTimer)
      finishTurnRef.current = null
      sessionRef.current += 1
      try { recognition.stop() } catch { /* already stopped */ }
      recognitionRef.current = null
      setInterim('')
      if (phaseRef.current !== 'connected') return
      const text = heard()
      if (text) { void callerSaid(text); return }
      if (failed) { setActivity('waiting'); return }
      const state = callRef.current
      if (state && state.misses < MAX_AUTO_LISTEN_MISSES) void applyTurn(handleSilence(state))
      else setActivity('waiting')
    }
    finishTurnRef.current = finish

    recognition.onstart = () => { if (session === sessionRef.current) setActivity('listening') }
    recognition.onresult = (event) => {
      if (session !== sessionRef.current) return
      const result = transcriptFromResults(event.results)
      finalText = result.finalText
      partial = result.interim
      setInterim(heard())
      // Every new word restarts the silence countdown.
      clearTimeout(silenceTimer)
      silenceTimer = setTimeout(finish, silenceMs)
    }
    recognition.onerror = (event) => {
      if (session !== sessionRef.current || event.error === 'no-speech' || event.error === 'aborted') return
      failed = true
      const message = speechErrorMessage(event.error)
      if (message) setNotice(message)
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') { mutedRef.current = true; setMuted(true) }
    }
    // Browsers also end continuous sessions on their own (long silence, network hiccup).
    recognition.onend = () => finish()
    recognitionRef.current = recognition
    try {
      recognition.start()
    } catch {
      finished = true
      clearTimeout(maxTimer)
      setActivity('waiting')
    }
  }

  // ---- The conversation loop ---------------------------------------------------------

  async function agentSay(text: string, token: number) {
    addLine({ who: 'agent', text })
    setActivity('speaking')
    await voice(text, callRef.current?.language ?? language)
    return token === turnRef.current && phaseRef.current === 'connected'
  }

  async function applyTurn(turn: CallTurn): Promise<void> {
    if (phaseRef.current !== 'connected') return
    const token = ++turnRef.current
    let state = turn.state
    let say = turn.say
    // The read-back mentions when no authority team covers the PIN yet.
    if (state.stage === 'confirm' && state.slots.covered === undefined) {
      const covered = await coverage(state.slots.pin)
      const before = currentQuestion(state)
      state = withCoverage(state, state.slots.pin, covered)
      if (say === before) say = currentQuestion(state)
    } else if (state.slots.pin && state.slots.covered === undefined) {
      void coverage(state.slots.pin).then((covered) => {
        if (callRef.current) callRef.current = withCoverage(callRef.current, state.slots.pin, covered)
      })
    }
    setCall(state)
    if (say && !(await agentSay(say, token))) return
    if (token !== turnRef.current || phaseRef.current !== 'connected') return

    if (turn.action === 'classify') {
      setActivity('thinking')
      const analysis = await analyzeComplaintRequest(state.slots.problem, languageOf(state.language).name, { pin: state.slots.pin, locality: state.slots.locality, onlineConsent: optionsRef.current.cloudAi })
      analysisRef.current = analysis
      if (token !== turnRef.current) return
      return applyTurn(afterClassify(callRef.current ?? state, analysis))
    }
    if (turn.action === 'file') return fileComplaint(token)
    if (turn.action === 'withdraw') return takeBackDuringCall(token)
    if (turn.action === 'hangup') { await wait(500); hangUp(); return }
    if (state.misses < MAX_AUTO_LISTEN_MISSES) listen()
    else setActivity('waiting')
  }

  async function callerSaid(text: string) {
    const state = callRef.current
    if (!state || !awaitingCaller(state)) return
    stopListening()
    addLine({ who: 'caller', text })
    await applyTurn(handleReply(state, text))
  }

  async function fileComplaint(token: number) {
    const state = callRef.current
    if (!state) return
    setActivity('thinking')
    const { slots: s } = state
    const analysis = analysisRef.current ?? analyzeComplaint(s.problem, languageOf(state.language).name, { pin: s.pin, locality: s.locality })
    if (!user) return applyTurn(afterFileFailed(state, 'Please sign in on this site first.'))
    const payload = {
      title: `${s.issue || analysis.issue} — ${s.locality}`.slice(0, 140),
      description: `${s.problem}${s.duration ? ` (for ${s.duration})` : ''}${s.proof ? ' Proof is available on request.' : ''}`,
      original_text: s.problem,
      normalized_text: analysis.summary,
      category: analysis.category,
      department: s.department || analysis.department,
      pin: s.pin,
      locality: s.locality,
      source_channel: 'voice' as const,
      language: analysis.language,
      ai_confidence: analysis.confidence,
      severity: analysis.severity,
      location_lat: coordsRef.current?.latitude,
      location_lng: coordsRef.current?.longitude,
      consent: { browser_speech: optionsRef.current.voiceConsent, caller_confirmed: true, raw_audio_retained: false, device_location: Boolean(coordsRef.current), ai_call_agent: true },
    }
    try {
      if (!navigator.onLine) {
        if (!optionsRef.current.offline) throw new Error('You are offline. Reconnect, or allow on-device drafts in your profile.')
        await saveOfflineDraft(payload)
        setPendingDraft(true)
        if (token !== turnRef.current) return
        return applyTurn(afterDraftSaved(state))
      }
      const filed = await submitIssuePayload(payload)
      issueRef.current = filed
      setIssue(filed)
      haptic('success')
      if (token !== turnRef.current) return
      return applyTurn(afterFiled(state, filed.documentId))
    } catch (error) {
      haptic('error')
      if (token !== turnRef.current) return
      return applyTurn(afterFileFailed(state, error instanceof Error ? error.message : 'The server did not accept it.'))
    }
  }

  async function takeBackDuringCall(token: number) {
    const state = callRef.current
    const filed = issueRef.current
    if (!state) return
    setActivity('thinking')
    if (!filed) return applyTurn(afterWithdrawFailed(state, ''))
    try {
      const result = await withdrawIssueRequest(filed.id, 'Taken back during the voice call')
      setWithdrawal(result)
      haptic('success')
      if (token !== turnRef.current) return
      return applyTurn(afterWithdrawn(state, result.outcome))
    } catch (error) {
      haptic('error')
      if (token !== turnRef.current) return
      return applyTurn(afterWithdrawFailed(state, error instanceof Error ? error.message : ''))
    }
  }

  async function takeBackAfterCall() {
    if (!issue) return
    if (!confirmTakeBack) { setConfirmTakeBack(true); haptic('warning'); return }
    setTakeBackBusy(true)
    setTakeBackError('')
    try {
      setWithdrawal(await withdrawIssueRequest(issue.id, 'Taken back after the voice call'))
      haptic('success')
    } catch (error) {
      haptic('error')
      setTakeBackError(error instanceof Error ? error.message : 'The complaint could not be taken back.')
    } finally {
      setTakeBackBusy(false)
      setConfirmTakeBack(false)
    }
  }

  // ---- Call controls -----------------------------------------------------------------

  async function dial() {
    if (phaseRef.current === 'ringing' || phaseRef.current === 'connected') return
    haptic('tap')
    try {
      const AudioCtor = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      audioRef.current = audioRef.current ?? (AudioCtor ? new AudioCtor() : null)
      void audioRef.current?.resume()
    } catch {
      audioRef.current = null
    }
    // Unlock speech synthesis inside the tap; some browsers block speech started later otherwise.
    try { window.speechSynthesis?.speak(new SpeechSynthesisUtterance('')) } catch { /* no speech synthesis */ }

    setLines([]); setInterim(''); setSeconds(0); setIssue(null); setPendingDraft(false); setNotice('')
    setWithdrawal(null); setConfirmTakeBack(false); setTakeBackError('')
    setKeyBuffer(''); setKeypadOpen(false); setTyped(''); setSlots(null); setSettled(false)
    analysisRef.current = null
    issueRef.current = null
    coordsRef.current = null
    detectedRef.current = null
    mutedRef.current = muted
    phaseRef.current = 'ringing'
    setPhase('ringing')
    ringback(audioRef.current)

    let detected: CallState['detected'] = null
    const located = shareLocation ? live.locate().then((result) => {
      if (!result) return null
      coordsRef.current = { latitude: result.latitude, longitude: result.longitude }
      const place = result.place?.pin && result.place.locality ? { pin: result.place.pin, locality: result.place.locality } : null
      if (place) { detectedRef.current = place; void coverage(place.pin) }
      return place
    }) : Promise.resolve(null)
    void located.then((place) => { detected = place })

    await Promise.all([wait(RING_SECONDS * 1000), waitForVoices()])
    if (phaseRef.current !== 'ringing') return
    if (!cloudVoiceRef.current && !voiceFor(languageOf(language).tag).voice) setNotice(UI[language].noVoice(UI[language].names[language]))
    tone(audioRef.current, [1400], 0, 0.08, 0.04)
    haptic('success')
    phaseRef.current = 'connected'
    setPhase('connected')
    const opening = startCall(language, detected)
    // Location that arrives after pickup is still offered when the agent reaches that question.
    if (!detected) void located.then((place) => { if (place && callRef.current) callRef.current = withDetectedLocation(callRef.current, place) })
    await applyTurn(opening)
  }

  function hangUp() {
    if (phaseRef.current === 'idle' || phaseRef.current === 'ended') return
    haptic('warning')
    turnRef.current += 1
    stopListening()
    stopVoice()
    tone(audioRef.current, [480, 620], 0, 0.25)
    phaseRef.current = 'ended'
    setPhase('ended')
    setActivity('waiting')
    setKeypadOpen(false)
  }

  function goBack() {
    hangUp()
    if (window.history.length > 1) router.back()
    else router.push('/citizen')
  }

  function toggleMute() {
    const next = !mutedRef.current
    mutedRef.current = next
    setMuted(next)
    haptic('tap')
    if (next) { stopListening(); setActivity('waiting') } else if (activity !== 'speaking' && activity !== 'thinking') listen()
  }

  function toggleSpeaker() {
    const next = !speakerRef.current
    speakerRef.current = next
    setSpeakerOn(next)
    haptic('tap')
    if (!next) stopVoice()
  }

  /** Says the current question again. */
  function repeatQuestion() {
    const state = callRef.current
    if (!state || !awaitingCaller(state) || activity === 'thinking') return
    haptic('tap')
    stopListening()
    stopVoice()
    void applyTurn({ state: { ...state, misses: 0 }, say: currentQuestion(state) })
  }

  /** Starts the conversation again from the first question, on the same call. */
  function restartConversation() {
    const state = callRef.current
    if (phaseRef.current !== 'connected' || !state || activity === 'thinking' || state.stage === 'filing') return
    haptic('tap')
    stopListening()
    stopVoice()
    setLines([])
    setKeyBuffer('')
    analysisRef.current = null
    void applyTurn(startCall(state.language, detectedRef.current))
  }

  function talkNow() {
    haptic('tap')
    stopVoice()
    turnRef.current += 1
    if (mutedRef.current) { mutedRef.current = false; setMuted(false) }
    listen()
  }

  function sendTyped() {
    const text = typed.trim()
    if (!text) return
    setTyped('')
    stopVoice()
    void callerSaid(text)
  }

  function sendDigits(digits: string) {
    const state = callRef.current
    if (!state || !awaitingCaller(state)) return
    stopListening()
    stopVoice()
    setKeyBuffer('')
    addLine({ who: 'caller', text: `⌨ ${digits}` })
    void applyTurn(handleDigits(state, digits))
  }

  function pressKey(key: string) {
    haptic('tap')
    const [low, high] = DTMF[key]
    tone(audioRef.current, [low, high], 0, 0.12)
    if (key === '*') { setKeyBuffer(''); return }
    if (key === '#') { if (keyBuffer) sendDigits(keyBuffer); return }
    // Yes/no questions take one key; the PIN is sent once all six digits are in.
    if (['proof', 'confirm', 'failed'].includes(stage)) { sendDigits(key); return }
    const next = `${keyBuffer}${key}`.slice(0, 6)
    if (next.length === 6 && (stage === 'location' || stage === 'pin')) { sendDigits(next); return }
    setKeyBuffer(next)
  }

  // ---- Screen ------------------------------------------------------------------------

  const inCall = phase === 'ringing' || phase === 'connected'
  const busy = activity === 'thinking' || stage === 'filing'
  const statusText = phase === 'ringing'
    ? ui.ringing
    : activity === 'speaking' ? ui.speaking
      : activity === 'listening' ? ui.listening
        : activity === 'thinking' ? (stage === 'filing' ? ui.filing : stage === 'done' ? ui.withdrawing : ui.understanding)
          : muted || !speechSupported || !voiceConsent ? ui.yourTurnType : ui.yourTurnMic

  const checklist: Array<[string, boolean]> = slots ? [
    [ui.checklist[0], Boolean(slots.issue)],
    [ui.checklist[1], Boolean(slots.locality && settled)],
    [ui.checklist[2], /^\d{6}$/.test(slots.pin) && settled],
    [ui.checklist[3], slots.duration !== null],
    [ui.checklist[4], slots.proof !== null],
    [ui.checklist[5], Boolean(issue)],
  ] : []

  return (
    <main className="min-h-dvh bg-background text-charcoal">
      <SiteNav />
      <section className="mx-auto flex max-w-5xl flex-col items-center gap-8 px-4 py-4 sm:px-6 sm:py-8 lg:flex-row lg:items-start lg:justify-center lg:py-12">
        <div className="order-2 max-w-md text-center lg:order-1 lg:mt-16 lg:text-left" lang={language}>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-terracotta">{ui.kicker}</p>
          <h1 className="mt-2 font-display text-3xl font-extrabold sm:text-4xl">{ui.title}</h1>
          <p className="mt-3 text-sm leading-relaxed text-charcoal/70">{ui.intro}</p>
          <ol className="mt-5 hidden space-y-2 text-sm text-charcoal/70 lg:block">
            {ui.steps.map((step, index) => (
              <li key={step} className="flex items-center gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-chai/10 text-xs font-bold text-chai">{index + 1}</span>{step}</li>
            ))}
          </ol>
          <p className="mt-6 hidden text-xs leading-relaxed text-charcoal/50 lg:block">{ui.note}</p>
        </div>

        <div lang={language} className="relative order-1 flex h-[min(700px,calc(100dvh-6rem))] min-h-[560px] w-full lg:order-2 max-w-sm flex-col overflow-hidden rounded-[2.25rem] border-[6px] border-charcoal bg-[#1d1714] text-cream shadow-2xl">
          {/* Top bar */}
          <div className="flex items-center justify-between px-4 pt-4 text-[11px] font-semibold text-cream/55">
            <button type="button" onClick={goBack} aria-label={ui.back} className="flex h-9 w-9 items-center justify-center rounded-full bg-cream/10 text-cream transition active:scale-95"><ArrowLeft className="h-4 w-4" /></button>
            <span className="tabular-nums">{phase === 'connected' ? clock(seconds) : 'CivicChai'}</span>
            <span className="rounded-full bg-cream/10 px-2 py-0.5">{ui.badge}</span>
          </div>

          {/* Caller ID */}
          <div className={`flex flex-col items-center px-6 transition-all ${inCall ? 'pt-2' : 'pt-8'}`}>
            <div className="relative flex items-center justify-center">
              {(phase === 'ringing' || activity === 'speaking') && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-terracotta/40" />}
              {activity === 'listening' && phase === 'connected' && <span className="absolute -inset-2 animate-pulse rounded-full border-2 border-leaf/70" />}
              <div className={`relative flex items-center justify-center rounded-full bg-gradient-to-br from-terracotta to-chai shadow-lg transition-all ${inCall ? 'h-16 w-16' : 'h-28 w-28'}`}>
                <Coffee className={inCall ? 'h-7 w-7' : 'h-12 w-12'} />
              </div>
            </div>
            <p className={`font-display font-extrabold ${inCall ? 'mt-2 text-lg' : 'mt-4 text-xl'}`}>{ui.helpline}</p>
            <p role="status" aria-live="polite" className="mt-0.5 text-sm text-cream/60">
              {phase === 'idle' ? ui.line : phase === 'ended' ? ui.ended(clock(seconds)) : statusText}
            </p>
          </div>

          {phase === 'idle' && (
            <div className="mt-6 flex flex-1 flex-col px-6 pb-7">
              <div className="grid grid-cols-3 gap-1 rounded-full bg-cream/10 p-1" role="radiogroup" aria-label="Call language">
                {LANGUAGES.map((item) => (
                  <button key={item.code} type="button" role="radio" aria-checked={language === item.code} onClick={() => setLanguage(item.code)} lang={item.code}
                    className={`rounded-full py-2 text-sm font-semibold transition ${language === item.code ? 'bg-cream text-charcoal' : 'text-cream/70'}`}>{item.label}</button>
                ))}
              </div>
              <div className="mt-4 space-y-2 text-xs leading-relaxed text-cream/70">
                <label className="flex items-start gap-2"><input type="checkbox" checked={voiceConsent} onChange={(event) => setVoiceConsent(event.target.checked)} className="mt-0.5 accent-terracotta" /><span>{ui.consentSpeech}</span></label>
                <label className="flex items-start gap-2"><input type="checkbox" checked={shareLocation} onChange={(event) => setShareLocation(event.target.checked)} className="mt-0.5 accent-terracotta" /><span>{ui.consentLocation}</span></label>
                <label className="flex items-start gap-2"><input type="checkbox" checked={cloudAi} onChange={(event) => setCloudAi(event.target.checked)} className="mt-0.5 accent-terracotta" /><span>{ui.consentCloud}</span></label>
              </div>
              {!speechSupported && <p className="mt-3 rounded-xl bg-gold/15 p-2.5 text-xs text-cream/80">{ui.noRecognition}</p>}
              <div className="mt-auto flex flex-col items-center gap-3 pt-6">
                {!isHydrated ? null : user ? (
                  <>
                    <button type="button" onClick={() => void dial()} aria-label={ui.tapToCall} className="flex h-16 w-16 items-center justify-center rounded-full bg-leaf text-cream shadow-lg transition active:scale-95"><Phone className="h-7 w-7" /></button>
                    <span className="text-xs text-cream/55">{ui.tapToCall} · {ui.youAre(user.handle ?? '')}</span>
                  </>
                ) : (
                  <Link href="/login?next=/voice-agent" className="w-full rounded-full bg-leaf py-3 text-center text-sm font-semibold text-cream">{ui.signIn}</Link>
                )}
              </div>
            </div>
          )}

          {inCall && (
            <div className="flex min-h-0 flex-1 flex-col px-4 pb-5">
              {checklist.length > 0 && !keypadOpen && (
                <div className="mt-2 flex flex-wrap justify-center gap-1.5" aria-label="Report progress">
                  {checklist.map(([label, done]) => (
                    <span key={label} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${done ? 'bg-leaf/25 text-cream' : 'bg-cream/8 text-cream/45'}`}>{done && <Check className="h-3 w-3" />}{label}</span>
                  ))}
                </div>
              )}

              {keypadOpen ? (
                <div className="mt-2 flex flex-1 flex-col">
                  <div className="flex h-10 items-center justify-center gap-2">
                    <p className="min-w-0 flex-1 text-center font-mono text-2xl tracking-[0.35em]">{keyBuffer || <span className="text-sm tracking-normal text-cream/40">{stage === 'location' || stage === 'pin' ? ui.keypadPin : ui.keypadYesNo}</span>}</p>
                    {keyBuffer && <button type="button" onClick={() => { haptic('tap'); setKeyBuffer((current) => current.slice(0, -1)) }} aria-label={ui.del} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-cream/70 active:bg-cream/10"><Delete className="h-5 w-5" /></button>}
                  </div>
                  <div className="mx-auto mt-2 grid w-full max-w-[240px] grid-cols-3 gap-3">
                    {KEYS.map((key) => (
                      <button key={key} type="button" onClick={() => pressKey(key)} className="aspect-square rounded-full bg-cream/10 font-display text-2xl font-bold transition active:scale-95 active:bg-cream/25">{key}</button>
                    ))}
                  </div>
                  <p className="mt-2 text-center text-[11px] text-cream/45">{ui.keypadHelp}</p>
                  <div className="mt-auto grid grid-cols-3 items-center pt-3">
                    <span />
                    <button type="button" onClick={hangUp} aria-label={ui.end} className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-heat text-cream shadow-lg transition active:scale-95"><PhoneOff className="h-7 w-7" /></button>
                    <button type="button" onClick={() => setKeypadOpen(false)} className="text-sm font-semibold text-cream/75">{ui.hide}</button>
                  </div>
                </div>
              ) : (
                <>
                  {captionsOn ? (
                    <div ref={captionsRef} className="mt-2 min-h-0 flex-1 space-y-2 overflow-y-auto rounded-2xl bg-black/20 p-3 text-sm" aria-live="polite" aria-label="Call captions">
                      {phase === 'ringing' && <p className="py-8 text-center text-cream/45">{live.status === 'locating' ? <><MapPin className="mr-1 inline h-4 w-4" />{ui.locating}</> : ui.connecting}</p>}
                      {lines.map((line, index) => (
                        <p key={index} className={`max-w-[88%] rounded-2xl px-3 py-2 leading-snug ${line.who === 'agent' ? 'bg-cream/10 text-cream' : 'ml-auto bg-terracotta text-cream'}`}>{line.text}</p>
                      ))}
                      {interim && <p className="ml-auto max-w-[88%] rounded-2xl bg-terracotta/40 px-3 py-2 italic text-cream/80">{interim}</p>}
                    </div>
                  ) : (
                    <div className="mt-2 flex min-h-0 flex-1 items-center justify-center rounded-2xl bg-black/10 text-xs text-cream/40">{ui.captionsOff}</div>
                  )}

                  {(notice || !speakerOn) && <p role="alert" className="mt-2 text-center text-[11px] leading-snug text-gold">{!speakerOn ? ui.speakerOff : notice}</p>}

                  {phase === 'connected' && (
                    <form onSubmit={(event) => { event.preventDefault(); sendTyped() }} className="mt-2 flex gap-2">
                      <input value={typed} onChange={(event) => setTyped(event.target.value.slice(0, 500))} placeholder={ui.typePlaceholder} lang={language} className="min-w-0 flex-1 rounded-full bg-cream/10 px-4 py-2 text-sm text-cream placeholder:text-cream/40 outline-none focus:bg-cream/15" />
                      <button type="submit" aria-label={ui.send} disabled={!typed.trim()} className="flex h-9 w-9 items-center justify-center rounded-full bg-terracotta disabled:opacity-40"><Send className="h-4 w-4" /></button>
                    </form>
                  )}

                  {phase === 'connected' && activity === 'waiting' && speechSupported && voiceConsent && !busy && (
                    <button type="button" onClick={talkNow} className="mx-auto mt-2 inline-flex items-center gap-2 rounded-full bg-leaf px-4 py-1.5 text-xs font-semibold text-cream"><Mic className="h-4 w-4" />{ui.tapToTalk}</button>
                  )}
                  {phase === 'connected' && activity === 'listening' && (
                    <button type="button" onClick={doneSpeaking} className="mx-auto mt-2 inline-flex items-center gap-2 rounded-full bg-cream px-4 py-1.5 text-xs font-semibold text-charcoal"><Check className="h-4 w-4" />{ui.doneSpeaking}</button>
                  )}
                  {phase === 'connected' && activity === 'speaking' && !busy && stage !== 'done' && speechSupported && voiceConsent && (
                    <button type="button" onClick={talkNow} className="mx-auto mt-2 text-[11px] font-semibold text-cream/50 underline">{ui.interrupt}</button>
                  )}

                  <div className="mt-3 grid grid-cols-3 gap-y-3">
                    <CallButton label={muted ? ui.unmute : ui.mute} onClick={toggleMute} active={muted} disabled={phase !== 'connected'}>{muted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}</CallButton>
                    <CallButton label={ui.keypad} onClick={() => { haptic('tap'); setKeypadOpen(true) }} disabled={phase !== 'connected'}><Grid3x3 className="h-5 w-5" /></CallButton>
                    <CallButton label={ui.speaker} onClick={toggleSpeaker} active={speakerOn}>{speakerOn ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}</CallButton>
                    <CallButton label={ui.repeat} onClick={repeatQuestion} disabled={phase !== 'connected' || busy || stage === 'done'}><Repeat2 className="h-5 w-5" /></CallButton>
                    <CallButton label={ui.captions} onClick={() => { haptic('tap'); setCaptionsOn((on) => !on) }} active={captionsOn}>{captionsOn ? <Captions className="h-5 w-5" /> : <CaptionsOff className="h-5 w-5" />}</CallButton>
                    <CallButton label={ui.restart} onClick={restartConversation} disabled={phase !== 'connected' || busy || stage === 'done'}><RefreshCw className="h-5 w-5" /></CallButton>
                  </div>
                  <button type="button" onClick={hangUp} aria-label={ui.end} className="mx-auto mt-3 flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-heat text-cream shadow-lg transition active:scale-95"><PhoneOff className="h-7 w-7" /></button>
                </>
              )}
            </div>
          )}

          {phase === 'ended' && (
            <div className="mt-5 flex min-h-0 flex-1 flex-col px-6 pb-7">
              {withdrawal ? (
                <div className="rounded-2xl bg-cream/10 p-4 text-center">
                  <Undo2 className="mx-auto h-8 w-8 text-cream/70" />
                  <p className="mt-2 text-sm font-semibold">{ui.takenBack}</p>
                  <p className="mt-1 text-xs leading-relaxed text-cream/65">{withdrawal.outcome === 'deleted' ? ui.deletedMsg(withdrawal.documentId) : ui.withdrawnMsg(withdrawal.documentId)}</p>
                </div>
              ) : issue ? (
                <div className="rounded-2xl bg-leaf/20 p-4 text-center">
                  <Check className="mx-auto h-8 w-8 text-leaf" />
                  <p className="mt-2 text-sm text-cream/70">{ui.filed}</p>
                  <p className="mt-1 font-mono text-base font-bold">{issue.documentId}</p>
                  <p className="mt-1 text-xs text-cream/60">{ui.routed(issue.department)}</p>
                  <div className="mt-3 flex justify-center gap-4 text-sm font-semibold">
                    <Link href={`/issues/${encodeURIComponent(issue.id)}`} className="underline">{ui.openReport}</Link>
                    <Link href="/citizen" className="underline">{ui.myCharcha}</Link>
                  </div>
                  <button type="button" onClick={() => void takeBackAfterCall()} disabled={takeBackBusy} className={`mt-4 inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold transition disabled:opacity-60 ${confirmTakeBack ? 'bg-heat text-cream' : 'border border-cream/25 text-cream/80'}`}>
                    <Undo2 className="h-3.5 w-3.5" />{takeBackBusy ? ui.takingBack : confirmTakeBack ? ui.confirmTakeBack : ui.takeBack}
                  </button>
                  {takeBackError && <p role="alert" className="mt-2 text-xs text-gold">{takeBackError}</p>}
                </div>
              ) : (
                <p className="rounded-2xl bg-cream/10 p-4 text-center text-sm text-cream/70">{pendingDraft ? ui.draftSaved : ui.noReport}</p>
              )}
              {lines.length > 0 && (
                <details className="mt-4 min-h-0 text-xs text-cream/60">
                  <summary className="cursor-pointer font-semibold">{ui.transcript(lines.length)}</summary>
                  <div className="mt-2 max-h-40 space-y-1.5 overflow-y-auto">
                    {lines.map((line, index) => <p key={index}><span className="font-semibold text-cream/80">{line.who === 'agent' ? ui.agent : ui.you}:</span> {line.text}</p>)}
                  </div>
                </details>
              )}
              <div className="mt-auto flex flex-col items-center gap-2 pt-5">
                <button type="button" onClick={() => void dial()} className="flex h-14 w-14 items-center justify-center rounded-full bg-leaf text-cream shadow-lg active:scale-95" aria-label={ui.callAgain}><Phone className="h-6 w-6" /></button>
                <span className="text-xs text-cream/55">{ui.callAgain}</span>
              </div>
            </div>
          )}
        </div>
      </section>
      <p className="mx-auto max-w-md px-4 pb-10 text-center text-xs text-charcoal/55" lang={language}>{ui.preferForm} <Link href="/voice-agent?mode=form" className="font-semibold text-chai underline">{ui.formLink}</Link>.</p>
      <SiteFooter />
    </main>
  )
}
