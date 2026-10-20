import { createHmac, timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { analyzeComplaint } from '@/lib/ai'
import { createIssue } from '@/lib/issues'
import { getSupabaseServiceClient } from '@/lib/supabase'

export const runtime = 'nodejs'

type VoiceSession = {
  call_sid: string
  stage: string
  language: string
  complaint_text: string | null
  pin: string | null
  locality: string | null
  duration: string | null
  has_evidence: boolean | null
  consented_at: string | null
}

const LANGUAGES: Record<string, { name: string; twilio: string }> = {
  '1': { name: 'Hindi', twilio: 'hi-IN' },
  '2': { name: 'Marathi', twilio: 'mr-IN' },
  '3': { name: 'English', twilio: 'en-IN' },
}

const CATEGORIES: Record<string, { title: string; category: string; department: string }> = {
  '1': { title: 'Road damage or pothole', category: 'Roads & Potholes', department: 'PWD — Roads Division' },
  '2': { title: 'Streetlight outage', category: 'Public Lighting', department: 'Municipal Public Lighting' },
  '3': { title: 'Garbage overflow', category: 'Sanitation', department: 'Solid Waste Management' },
  '4': { title: 'Water supply disruption', category: 'Water Supply', department: 'Water Works Department' },
  '5': { title: 'Drainage or sewage issue', category: 'Drainage', department: 'Drainage & Sewerage' },
  '6': { title: 'General civic issue', category: 'General civic issue', department: 'Municipal Operations' },
}

function xmlEscape(value: string) {
  return value.replace(/[<>&"']/g, (char) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[char]!)
}

function twiml(body: string) {
  return new NextResponse(`<?xml version="1.0" encoding="UTF-8"?><Response>${body}</Response>`, {
    headers: { 'Content-Type': 'text/xml; charset=utf-8', 'Cache-Control': 'no-store' },
  })
}

function say(text: string, language = 'en-IN') {
  return `<Say language="${language}">${xmlEscape(text)}</Say>`
}

function gather(text: string, input = 'dtmf', options: { digits?: number; language?: string; speech?: boolean } = {}) {
  const base = (process.env.APP_BASE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '')
  const action = base ? `${base}/api/voice/ivr` : '/api/voice/ivr'
  const attrs = [
    `input="${options.speech ? 'speech dtmf' : input}"`,
    'timeout="7"',
    `action="${xmlEscape(action)}"`,
    'method="POST"',
    'actionOnEmptyResult="true"',
    `language="${options.language ?? 'en-IN'}"`,
    ...(options.digits ? [`numDigits="${options.digits}"`] : []),
    ...(options.speech ? ['speechTimeout="auto"'] : []),
  ].join(' ')
  return `<Gather ${attrs}>${say(text, options.language ?? 'en-IN')}</Gather>${say('We did not receive a response. Please call again or use the CivicChai web portal.', options.language ?? 'en-IN')}<Hangup/>`
}

function validTwilioSignature(url: string, fields: URLSearchParams, signature: string, authToken: string) {
  let input = url
  for (const key of [...new Set([...fields.keys()])].sort()) {
    input += key + fields.getAll(key).join('')
  }
  const expected = createHmac('sha1', authToken).update(input).digest('base64')
  const actualBuffer = Buffer.from(signature)
  const expectedBuffer = Buffer.from(expected)
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer)
}

function messageFor(session: VoiceSession) {
  const category = session.complaint_text?.startsWith('[KEYPAD:') ? session.complaint_text.split(':')[1]?.replace(']', '') : ''
  const issue = category ? CATEGORIES[category]?.title : analyzeComplaint(session.complaint_text ?? '', session.language).issue
  return `${issue}. PIN ${session.pin}. ${session.locality}. Duration ${session.duration}. Evidence ${session.has_evidence ? 'available' : 'not available'}.`
}

export async function POST(request: Request) {
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const publicBase = process.env.APP_BASE_URL ?? process.env.NEXT_PUBLIC_APP_URL
  const service = getSupabaseServiceClient()
  if (!authToken || !publicBase || !service) return twiml(`${say('The voice service is not configured yet. Please use the CivicChai web portal.')}<Hangup/>`)

  const fields = new URLSearchParams(await request.text())
  const signature = request.headers.get('x-twilio-signature') ?? ''
  const incomingUrl = `${publicBase.replace(/\/$/, '')}${new URL(request.url).pathname}${new URL(request.url).search}`
  if (!validTwilioSignature(incomingUrl, fields, signature, authToken)) return new NextResponse('Invalid telephony signature', { status: 403 })

  const callSid = fields.get('CallSid') ?? ''
  if (!callSid || callSid.length > 100) return new NextResponse('Missing call id', { status: 400 })
  const digit = fields.get('Digits')?.trim() ?? ''
  const spoken = fields.get('SpeechResult')?.trim().slice(0, 2000) ?? ''
  await service.from('voice_sessions').delete().lt('expires_at', new Date().toISOString())
  const { data: existing } = await service.from('voice_sessions').select('*').eq('call_sid', callSid).maybeSingle()
  let session = existing as VoiceSession | null
  if (!session) {
    const { data, error } = await service.from('voice_sessions').insert({ call_sid: callSid, stage: 'language' }).select('*').single()
    if (error) return twiml(`${say('Sorry, the voice service is busy. Please call again later.')}<Hangup/>`)
    session = data as VoiceSession
    return twiml(gather('Welcome to CivicChai. This call uses speech to text only if you choose it. Press 1 for Hindi, 2 for Marathi, or 3 for English.', 'dtmf', { digits: 1 }))
  }
  if (session.stage === 'complete') return twiml(`${say(`Your report ${session.complaint_text ?? 'was filed'} is already recorded.`)}<Hangup/>`)

  const update = async (changes: Record<string, unknown>, nextStage: string) => {
    const { data } = await service.from('voice_sessions').update({ ...changes, stage: nextStage, updated_at: new Date().toISOString() }).eq('call_sid', callSid).select('*').single()
    session = data as VoiceSession
  }

  if (session.stage === 'language') {
    const choice = LANGUAGES[digit]
    if (!choice) return twiml(gather('Press 1 for Hindi, 2 for Marathi, or 3 for English.', 'dtmf', { digits: 1 }))
    await update({ language: choice.name }, 'consent')
    return twiml(gather('Do you consent to speech recognition transcribing your complaint? CivicChai will keep the text but not the audio. Press 1 to speak, or 2 to use keypad categories.', 'dtmf', { digits: 1, language: choice.twilio }))
  }

  const sessionLanguage = session.language === 'Hindi' ? 'hi-IN' : session.language === 'Marathi' ? 'mr-IN' : 'en-IN'

  if (session.stage === 'consent') {
    if (digit === '1') {
      await update({ consented_at: new Date().toISOString() }, 'problem')
      return twiml(gather('Tell us what happened. Say the problem, then review the summary before it is filed.', 'speech', { speech: true, language: sessionLanguage }))
    }
    if (digit === '2') {
      await update({ complaint_text: '[KEYPAD:6]', consented_at: null }, 'category')
      return twiml(gather('For a keypad report, select a category. Press 1 for road damage, 2 for streetlights, 3 for waste, 4 for water, 5 for drainage, or 6 for another civic issue.', 'dtmf', { digits: 1, language: sessionLanguage }))
    }
    return twiml(gather('Press 1 to consent to speech transcription, or 2 to use keypad categories.', 'dtmf', { digits: 1, language: sessionLanguage }))
  }

  if (session.stage === 'problem') {
    if (digit === '0' && !spoken) {
      await update({}, 'category')
      return twiml(gather('Press 1 for road damage, 2 for streetlights, 3 for waste, 4 for water, 5 for drainage, or 6 for another civic issue.', 'dtmf', { digits: 1, language: sessionLanguage }))
    }
    if (!spoken) return twiml(gather('I did not get a clear transcription. Speak again, or press 0 for keypad categories.', 'speech dtmf', { speech: true, language: sessionLanguage }))
    await update({ complaint_text: spoken }, 'pin')
    return twiml(gather('Enter the six digit PIN code for the problem location.', 'dtmf', { digits: 6, language: sessionLanguage }))
  }

  if (session.stage === 'category') {
    if (!CATEGORIES[digit]) return twiml(gather('Press 1 for road damage, 2 for streetlights, 3 for waste, 4 for water, 5 for drainage, or 6 for another issue.', 'dtmf', { digits: 1, language: sessionLanguage }))
    await update({ complaint_text: `[KEYPAD:${digit}]` }, 'pin')
    return twiml(gather('Enter the six digit PIN code for the problem location.', 'dtmf', { digits: 6, language: sessionLanguage }))
  }

  if (session.stage === 'pin') {
    const pin = digit || spoken.replace(/\D/g, '')
    if (!/^\d{6}$/.test(pin)) return twiml(gather('That PIN must contain six digits. Enter the six digit PIN code.', 'dtmf', { digits: 6, language: sessionLanguage }))
    await update({ pin }, 'duration')
    return twiml(gather('How long has this been happening? Press 1 for today, 2 for a week, 3 for a month, 4 for longer, or 5 if unsure.', 'dtmf', { digits: 1, language: sessionLanguage }))
  }

  if (session.stage === 'duration') {
    const duration = ({ '1': 'today', '2': 'about one week', '3': 'about one month', '4': 'more than one month', '5': 'unspecified duration' } as Record<string, string>)[digit]
    if (!duration) return twiml(gather('Press 1 for today, 2 for a week, 3 for a month, 4 for longer, or 5 if unsure.', 'dtmf', { digits: 1, language: sessionLanguage }))
    await update({ duration }, 'evidence')
    return twiml(gather('Do you have a photograph or other proof to share later? Press 1 for yes or 2 for no.', 'dtmf', { digits: 1, language: sessionLanguage }))
  }

  if (session.stage === 'evidence') {
    if (!['1','2'].includes(digit)) return twiml(gather('Press 1 if proof is available or 2 if there is no proof.', 'dtmf', { digits: 1, language: sessionLanguage }))
    await update({ has_evidence: digit === '1', locality: `PIN ${session.pin} area` }, 'review')
    const summary = messageFor(session)
    return twiml(gather(`Please listen to the complaint summary: ${summary} Press 1 to confirm and submit. Press 2 to correct the description.`, 'dtmf', { digits: 1, language: sessionLanguage }))
  }

  if (session.stage === 'review') {
    const confirmation = digit || (/^(yes|haan|हो|होय)$/i.test(spoken) ? '1' : '')
    if (confirmation === '2') {
      await update({ complaint_text: null }, 'problem')
      return twiml(gather('Please say the corrected complaint now.', 'speech', { speech: true, language: sessionLanguage }))
    }
    if (confirmation !== '1') return twiml(gather(`Summary: ${messageFor(session)} Press 1 to confirm, or 2 to correct the description.`, 'dtmf', { digits: 1, language: sessionLanguage }))

    const categoryKey = session.complaint_text?.match(/^\[KEYPAD:(\d)\]$/)?.[1]
    const category = categoryKey ? CATEGORIES[categoryKey] : null
    const complaint = category ? `${category.title} reported through the keypad voice service.` : session.complaint_text ?? 'Civic issue reported by phone.'
    const analysis = analyzeComplaint(complaint, session.language, { pin: session.pin ?? undefined, locality: session.locality ?? undefined, hasEvidence: Boolean(session.has_evidence) })
    const issue = await createIssue({
      title: category?.title ?? analysis.issue,
      description: `${complaint} Duration: ${session.duration ?? 'unspecified'}.`,
      original_text: `${complaint} Duration: ${session.duration ?? 'unspecified'}.`,
      normalized_text: `${analysis.summary} Input was confirmed by the caller before submission.`,
      category: category?.category ?? analysis.category,
      department: category?.department ?? analysis.department,
      pin: session.pin ?? '000000',
      locality: session.locality ?? `PIN ${session.pin} area`,
      source_channel: 'keypad',
      language: session.language,
      ai_confidence: analysis.confidence,
      severity: analysis.severity,
      consent: { speech_transcription: Boolean(session.consented_at), caller_confirmed: true, raw_audio_retained: false },
    }, service)
    await service.from('voice_sessions').update({ stage: 'complete', complaint_text: issue.documentId, pin: null, locality: null, duration: null, has_evidence: null, consented_at: null, issue_id: issue.id, updated_at: new Date().toISOString() }).eq('call_sid', callSid)
    return twiml(`${say(`Confirmed. Your CivicChai report ${issue.documentId} has been filed. The suggested department is ${issue.department}. Thank you.` , sessionLanguage)}<Hangup/>`)
  }

  return twiml(`${say('The session expired. Please call again.', sessionLanguage)}<Hangup/>`)
}
