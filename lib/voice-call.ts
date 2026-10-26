// The CivicChai call agent (SOP §9): a scripted, slot-filling conversation that runs the
// same questions as the IVR — problem → location/PIN → duration → proof → read-back →
// confirm → file → read the ID back. It is pure so it can run in the browser, offline,
// and in tests. Classification and filing are requested from the caller as actions.

export type CallLanguage = 'en' | 'hi' | 'mr'
export type CallStage = 'problem' | 'location' | 'pin' | 'duration' | 'proof' | 'confirm' | 'change' | 'filing' | 'failed' | 'filed' | 'done'

export type CallSlots = {
  problem: string
  pin: string
  locality: string
  /** null until asked; '' when the caller does not know. */
  duration: string | null
  proof: boolean | null
  issue: string
  department: string
  category: string
  /** Whether an authority team covers the PIN (undefined until checked). */
  covered?: boolean | null
}

export type CallState = {
  stage: CallStage
  language: CallLanguage
  slots: CallSlots
  /** Device location offered to the caller for confirmation. */
  detected: { pin: string; locality: string } | null
  locationSettled: boolean
  misses: number
}

export type CallAction = 'classify' | 'file' | 'withdraw' | 'hangup'
export type CallTurn = { state: CallState; say: string; action?: CallAction }

const TEXT = {
  en: {
    saved: 'You are offline, so I saved your complaint on this device. It is sent as soon as you reconnect. Thank you for calling CivicChai. Goodbye!',
    greet: "Namaste, you've reached CivicChai, the neighbourhood complaint line. I'm an AI assistant. Your browser turns your voice into text and no recording is kept. What problem would you like to report?",
    problemShort: 'Could you tell me a little more? What is broken, and where?',
    retellProblem: 'Okay, tell me the problem again.',
    ack: (issue: string, department: string) => `Got it. That sounds like ${issue.toLowerCase()}. It will go to ${department}.`,
    askDetected: (locality: string, pin: string) => `Your phone shows you are near ${locality}, PIN ${pin}. Is the problem here? Say yes, or tell me the correct area.`,
    askLocation: 'Where is the problem? Tell me the area name or a nearby landmark.',
    askPin: 'And the six-digit PIN code? You can say it, or type it on the keypad.',
    pinInvalid: "That didn't sound like a six-digit PIN. Please say it digit by digit, or use the keypad.",
    askDuration: 'How long has this been happening?',
    askProof: 'Do you have a photo or any proof you can share later? Say yes or no. You can also press 1 for yes, 2 for no.',
    confirm: (summary: string) => `Let me read it back. ${summary} Is this correct? Say yes to file it, or no to change something.`,
    askChange: 'What should I change: the problem, the place, how long, or the proof?',
    changeUnknown: 'Sorry. Please say problem, place, how long, or proof.',
    filing: 'Filing your complaint now.',
    filed: (id: string) => `Done! Your complaint is filed. Your report ID is ${id}. Once more: ${id}. You can track it in My Charcha. If you filed it by mistake, say "take it back" now. Otherwise, you can hang up.`,
    takeBackHint: 'If you filed it by mistake, say "take it back". Otherwise, you can hang up.',
    goodbye: 'Thank you for calling CivicChai. Goodbye!',
    withdrawing: 'Okay, taking it back.',
    withdrawn: (deleted: boolean) => `Done. Your complaint is ${deleted ? 'deleted' : 'withdrawn, and the authority will not act on it'}. Thank you for calling CivicChai. Goodbye!`,
    withdrawFailed: (reason: string) => `Sorry, I could not take it back. ${reason} You can still do it from My Charcha. Goodbye!`,
    failed: (reason: string) => `Sorry, I could not file it. ${reason} Say yes to try again, or end the call.`,
    notHeard: "Sorry, I didn't catch that.",
    keypadHint: 'You can also use the keypad, or type your answer below.',
    yesNo: 'Please say yes or no.',
    notCovered: (pin: string) => `Note: no authority team covers PIN ${pin} on CivicChai yet, so your report may wait for one.`,
    summary: (s: CallSlots, pin: string, issue: string) => `${issue} at ${s.locality}, PIN ${pin}. You said: ${trimEnd(s.problem)}. How long: ${s.duration ? trimEnd(s.duration) : 'not known'}. Proof: ${s.proof ? 'available' : 'not available'}.`,
  },
  hi: {
    saved: 'आप ऑफ़लाइन हैं, इसलिए आपकी शिकायत इसी डिवाइस पर सहेज ली गई है। इंटरनेट आते ही यह भेज दी जाएगी। CivicChai को कॉल करने के लिए धन्यवाद। नमस्ते!',
    greet: 'नमस्ते, आप CivicChai शिकायत लाइन पर हैं। मैं एक AI सहायिका हूँ। आपकी आवाज़ आपके ब्राउज़र में ही टेक्स्ट बनती है, कोई रिकॉर्डिंग नहीं रखी जाती। आपकी शिकायत किस बारे में है?',
    problemShort: 'थोड़ा और बताइए, क्या ख़राब है और कहाँ?',
    retellProblem: 'ठीक है, समस्या फिर से बताइए।',
    ack: (issue: string, department: string) => `ठीक है, समझ गई। इसे ${issue} के रूप में दर्ज किया जाएगा और ${department} को भेजा जाएगा।`,
    askDetected: (locality: string, pin: string) => `आपका फ़ोन बता रहा है कि आप ${locality}, पिन ${pin} के पास हैं। क्या समस्या यहीं है? हाँ कहिए, या सही जगह बताइए।`,
    askLocation: 'समस्या कहाँ है? इलाक़े का नाम या पास की कोई पहचान बताइए।',
    askPin: 'और छह अंकों का पिन कोड? बोलिए, या कीपैड पर दबाइए।',
    pinInvalid: 'यह छह अंकों का पिन नहीं लगा। एक-एक अंक बोलिए, या कीपैड इस्तेमाल कीजिए।',
    askDuration: 'यह कब से हो रहा है?',
    askProof: 'क्या आपके पास फ़ोटो या कोई सबूत है जो बाद में दे सकें? हाँ या ना कहिए। हाँ के लिए 1 और ना के लिए 2 भी दबा सकते हैं।',
    confirm: (summary: string) => `आपकी शिकायत ऐसी है: ${summary} क्या यह सही है? दर्ज करने के लिए हाँ कहिए, या कुछ बदलने के लिए ना।`,
    askChange: 'क्या बदलना है: समस्या, जगह, कब से, या सबूत?',
    changeUnknown: 'माफ़ कीजिए। समस्या, जगह, कब से, या सबूत कहिए।',
    filing: 'आपकी शिकायत दर्ज की जा रही है।',
    filed: (id: string) => `हो गया! आपकी शिकायत दर्ज हो गई है। आपकी रिपोर्ट आईडी है ${id}। फिर से: ${id}। आप इसे My Charcha में देख सकते हैं। अगर ग़लती से दर्ज हुई है, तो अभी "वापस लो" कहिए। नहीं तो आप कॉल काट सकते हैं।`,
    takeBackHint: 'अगर ग़लती से दर्ज हुई है, तो "वापस लो" कहिए। नहीं तो आप कॉल काट सकते हैं।',
    goodbye: 'CivicChai को कॉल करने के लिए धन्यवाद। नमस्ते!',
    withdrawing: 'ठीक है, शिकायत वापस ली जा रही है।',
    withdrawn: (deleted: boolean) => `हो गया। ${deleted ? 'आपकी शिकायत हटा दी गई है।' : 'आपकी शिकायत वापस ले ली गई है, अब इस पर कार्रवाई नहीं होगी।'} CivicChai को कॉल करने के लिए धन्यवाद। नमस्ते!`,
    withdrawFailed: (reason: string) => `माफ़ कीजिए, शिकायत वापस नहीं ली जा सकी। ${reason} आप यह My Charcha से कर सकते हैं। नमस्ते!`,
    failed: (reason: string) => `माफ़ कीजिए, शिकायत दर्ज नहीं हो पाई। ${reason} फिर से कोशिश के लिए हाँ कहिए, या कॉल काट दीजिए।`,
    notHeard: 'माफ़ कीजिए, सुनाई नहीं दिया।',
    keypadHint: 'आप कीपैड से, या नीचे टाइप करके भी जवाब दे सकते हैं।',
    yesNo: 'कृपया हाँ या ना कहिए।',
    notCovered: (pin: string) => `ध्यान दें, पिन ${pin} के लिए अभी CivicChai पर कोई अधिकारी टीम नहीं है, इसलिए रिपोर्ट को इंतज़ार करना पड़ सकता है।`,
    summary: (s: CallSlots, pin: string, issue: string) => `${s.locality}, पिन ${pin} में ${issue}। आपने कहा: ${trimEnd(s.problem)}। कब से: ${s.duration ? trimEnd(s.duration) : 'पता नहीं'}। सबूत: ${s.proof ? 'है' : 'नहीं है'}।`,
  },
  mr: {
    saved: 'तुम्ही ऑफलाइन आहात, म्हणून तुमची तक्रार याच डिव्हाइसवर जतन केली आहे. इंटरनेट मिळताच ती पाठवली जाईल. CivicChai ला कॉल केल्याबद्दल धन्यवाद. नमस्कार!',
    greet: 'नमस्कार, तुम्ही CivicChai तक्रार लाईनवर आहात. मी एक AI सहाय्यिका आहे. तुमचा आवाज तुमच्या ब्राउझरमध्येच मजकुरात बदलतो, कोणतेही रेकॉर्डिंग ठेवले जात नाही. तुमची तक्रार कशाबद्दल आहे?',
    problemShort: 'थोडं अजून सांगा, काय बिघडलं आहे आणि कुठे?',
    retellProblem: 'ठीक आहे, समस्या पुन्हा सांगा.',
    ack: (issue: string, department: string) => `ठीक आहे, समजलं. हे ${issue} म्हणून नोंदवलं जाईल आणि ${department}कडे पाठवलं जाईल.`,
    askDetected: (locality: string, pin: string) => `तुमचा फोन दाखवतो की तुम्ही ${locality}, पिन ${pin} जवळ आहात. समस्या इथेच आहे का? हो म्हणा, किंवा योग्य ठिकाण सांगा.`,
    askLocation: 'समस्या कुठे आहे? परिसराचं नाव किंवा जवळची खूण सांगा.',
    askPin: 'आणि सहा अंकी पिन कोड? बोला, किंवा कीपॅडवर दाबा.',
    pinInvalid: 'हा सहा अंकी पिन वाटला नाही. एक-एक अंक बोला, किंवा कीपॅड वापरा.',
    askDuration: 'हे किती दिवसांपासून होत आहे?',
    askProof: 'तुमच्याकडे फोटो किंवा काही पुरावा आहे का, जो नंतर देऊ शकाल? हो किंवा नाही म्हणा. हो साठी 1 आणि नाही साठी 2 दाबू शकता.',
    confirm: (summary: string) => `तुमची तक्रार अशी आहे: ${summary} हे बरोबर आहे का? नोंदवण्यासाठी हो म्हणा, किंवा काही बदलण्यासाठी नाही.`,
    askChange: 'काय बदलायचं आहे: समस्या, ठिकाण, किती दिवस, की पुरावा?',
    changeUnknown: 'माफ करा. समस्या, ठिकाण, किती दिवस, किंवा पुरावा म्हणा.',
    filing: 'तुमची तक्रार नोंदवली जात आहे.',
    filed: (id: string) => `झालं! तुमची तक्रार नोंदवली गेली. तुमचा रिपोर्ट आयडी आहे ${id}. पुन्हा एकदा: ${id}. तुम्ही तो My Charcha मध्ये पाहू शकता. चुकून नोंदवली असेल, तर आता "मागे घ्या" म्हणा. नाहीतर कॉल बंद करू शकता.`,
    takeBackHint: 'चुकून नोंदवली असेल, तर "मागे घ्या" म्हणा. नाहीतर कॉल बंद करू शकता.',
    goodbye: 'CivicChai ला कॉल केल्याबद्दल धन्यवाद. नमस्कार!',
    withdrawing: 'ठीक आहे, तक्रार मागे घेतली जात आहे.',
    withdrawn: (deleted: boolean) => `झालं. ${deleted ? 'तुमची तक्रार काढून टाकली आहे.' : 'तुमची तक्रार मागे घेतली आहे, आता त्यावर कारवाई होणार नाही.'} CivicChai ला कॉल केल्याबद्दल धन्यवाद. नमस्कार!`,
    withdrawFailed: (reason: string) => `माफ करा, तक्रार मागे घेता आली नाही. ${reason} तुम्ही हे My Charcha मधून करू शकता. नमस्कार!`,
    failed: (reason: string) => `माफ करा, तक्रार नोंदवता आली नाही. ${reason} पुन्हा प्रयत्न करण्यासाठी हो म्हणा, किंवा कॉल बंद करा.`,
    notHeard: 'माफ करा, ऐकू आलं नाही.',
    keypadHint: 'तुम्ही कीपॅड वापरून, किंवा खाली टाइप करूनही उत्तर देऊ शकता.',
    yesNo: 'कृपया हो किंवा नाही म्हणा.',
    notCovered: (pin: string) => `लक्षात घ्या, पिन ${pin} साठी अजून CivicChai वर कोणतीही अधिकारी टीम नाही, त्यामुळे रिपोर्टला थांबावं लागू शकतं.`,
    summary: (s: CallSlots, pin: string, issue: string) => `${s.locality}, पिन ${pin} येथे ${issue}. तुम्ही सांगितलं: ${trimEnd(s.problem)}. किती दिवसांपासून: ${s.duration ? trimEnd(s.duration) : 'माहीत नाही'}. पुरावा: ${s.proof ? 'आहे' : 'नाही'}.`,
  },
} satisfies Record<CallLanguage, unknown>

// What the agent adds when the complaint belongs to the Union or a State, not the local body.
const BEYOND_LOCAL: Record<CallLanguage, Record<string, string>> = {
  en: {
    'national-highway': "Note: national highways are the Union government's responsibility, under the National Highways Authority.",
    railways: "Note: railway property is the Union government's responsibility, under Indian Railways.",
    'posts-telecom': "Note: postal and telecom services are the Union government's responsibility.",
    'state-highway': "Note: state highways are looked after by the State's Public Works Department.",
    electricity: "Note: electricity supply is handled by the State's electricity distribution company.",
    traffic: 'Note: traffic enforcement is a job for the State traffic police.',
    suffix: 'Your report will record this so the local office can forward it.',
  },
  hi: {
    'national-highway': 'ध्यान दें, राष्ट्रीय राजमार्ग केंद्र सरकार की ज़िम्मेदारी है, जिसे राष्ट्रीय राजमार्ग प्राधिकरण देखता है।',
    railways: 'ध्यान दें, रेलवे की संपत्ति केंद्र सरकार की ज़िम्मेदारी है, जिसे भारतीय रेलवे देखती है।',
    'posts-telecom': 'ध्यान दें, डाक और दूरसंचार सेवाएँ केंद्र सरकार की ज़िम्मेदारी हैं।',
    'state-highway': 'ध्यान दें, राज्य राजमार्ग राज्य का लोक निर्माण विभाग देखता है।',
    electricity: 'ध्यान दें, बिजली आपूर्ति राज्य की बिजली वितरण कंपनी देखती है।',
    traffic: 'ध्यान दें, ट्रैफ़िक नियंत्रण राज्य की ट्रैफ़िक पुलिस का काम है।',
    suffix: 'आपकी रिपोर्ट में यह दर्ज होगा, ताकि स्थानीय कार्यालय इसे आगे भेज सके।',
  },
  mr: {
    'national-highway': 'लक्षात घ्या, राष्ट्रीय महामार्ग ही केंद्र सरकारची जबाबदारी आहे, ते राष्ट्रीय महामार्ग प्राधिकरण पाहतं.',
    railways: 'लक्षात घ्या, रेल्वेची मालमत्ता ही केंद्र सरकारची जबाबदारी आहे, ती भारतीय रेल्वे पाहते.',
    'posts-telecom': 'लक्षात घ्या, टपाल आणि दूरसंचार सेवा ही केंद्र सरकारची जबाबदारी आहे.',
    'state-highway': 'लक्षात घ्या, राज्य महामार्ग राज्याचा सार्वजनिक बांधकाम विभाग पाहतो.',
    electricity: 'लक्षात घ्या, वीजपुरवठा राज्याची वीज वितरण कंपनी पाहते.',
    traffic: 'लक्षात घ्या, वाहतूक नियंत्रण हे राज्याच्या वाहतूक पोलिसांचं काम आहे.',
    suffix: 'तुमच्या रिपोर्टमध्ये हे नोंदवलं जाईल, म्हणजे स्थानिक कार्यालय ते पुढे पाठवू शकेल.',
  },
}

// How the agent says each category's issue and department in Hindi and Marathi.
const SPOKEN_CATEGORY: Record<string, { hi: [string, string]; mr: [string, string] }> = {
  'Public Lighting': { hi: ['स्ट्रीटलाइट बंद होने की शिकायत', 'नगर पालिका के स्ट्रीटलाइट विभाग'], mr: ['पथदिवे बंद असल्याची तक्रार', 'महापालिकेच्या पथदिवे विभागा'] },
  Sanitation: { hi: ['कचरा जमा होने की शिकायत', 'ठोस कचरा प्रबंधन विभाग'], mr: ['कचरा साचल्याची तक्रार', 'घनकचरा व्यवस्थापन विभागा'] },
  'Roads & Potholes': { hi: ['सड़क ख़राब या गड्ढे की शिकायत', 'लोक निर्माण विभाग की सड़क शाखा'], mr: ['रस्ता खराब किंवा खड्ड्याची तक्रार', 'सार्वजनिक बांधकाम विभागाच्या रस्ते शाखे'] },
  'Water Supply': { hi: ['पानी की सप्लाई की शिकायत', 'जल विभाग'], mr: ['पाणीपुरवठ्याची तक्रार', 'पाणीपुरवठा विभागा'] },
  Drainage: { hi: ['नाली या सीवर की शिकायत', 'नाली और सीवरेज विभाग'], mr: ['गटार किंवा सांडपाण्याची तक्रार', 'गटार व मलनिस्सारण विभागा'] },
  Traffic: { hi: ['ट्रैफ़िक या सड़क सुरक्षा की शिकायत', 'ट्रैफ़िक पुलिस और लोक निर्माण विभाग'], mr: ['वाहतूक किंवा रस्ता सुरक्षेची तक्रार', 'वाहतूक पोलीस व सार्वजनिक बांधकाम विभागा'] },
  'Public Health': { hi: ['जन स्वास्थ्य से जुड़ी शिकायत', 'जन स्वास्थ्य कार्यालय'], mr: ['सार्वजनिक आरोग्याची तक्रार', 'सार्वजनिक आरोग्य कार्यालया'] },
  'General civic issue': { hi: ['नागरिक सेवा की शिकायत', 'नगर पालिका संचालन विभाग'], mr: ['नागरी सेवेची तक्रार', 'महापालिका कामकाज विभागा'] },
}

/** The issue and department as the agent says them in the caller's language. */
export function spokenCategory(state: CallState) {
  const { issue, department, category } = state.slots
  const local = state.language === 'en' ? undefined : SPOKEN_CATEGORY[category]?.[state.language]
  if (local) return { issue: local[0], department: local[1] }
  return { issue: issue || (state.language === 'en' ? 'A civic issue' : state.language === 'hi' ? 'नागरिक शिकायत' : 'नागरी तक्रार'), department }
}

function trimEnd(text: string) {
  return text.trim().replace(/[.!?।\s]+$/u, '')
}

export function callLanguage(label: string): CallLanguage {
  return /hindi|हिन्दी|हिंदी|^hi/i.test(label) ? 'hi' : /marathi|मराठी|^mr/i.test(label) ? 'mr' : 'en'
}

// ---- Understanding the caller -------------------------------------------------------

const DIGIT_WORDS: Record<string, string> = {
  zero: '0', oh: '0', one: '1', two: '2', three: '3', four: '4', five: '5', six: '6', seven: '7', eight: '8', nine: '9',
  शून्य: '0', ज़ीरो: '0', जीरो: '0', एक: '1', दो: '2', दोन: '2', तीन: '3', चार: '4', पांच: '5', पाँच: '5', पाच: '5', छह: '6', छः: '6', छे: '6', सहा: '6', सात: '7', आठ: '8', नौ: '9', नऊ: '9',
}
const MULTIPLIERS: Record<string, number> = { double: 2, triple: 3, डबल: 2, ट्रिपल: 3 }

function words(text: string) {
  return text.toLowerCase().replace(/[०-९]/g, (d) => String('०१२३४५६७८९'.indexOf(d))).split(/[\s,.!?;:'"()।-]+/u).filter(Boolean)
}

/** Finds a six-digit PIN in speech such as "401208", "4 0 1 2 0 8" or "four zero one two oh eight". */
export function extractPin(text: string) {
  let run = ''
  let repeat = 1
  const runs: string[] = []
  for (const word of words(text)) {
    if (MULTIPLIERS[word]) { repeat = MULTIPLIERS[word]; continue }
    const digits = /^\d+$/.test(word) ? word : DIGIT_WORDS[word]
    if (digits) { run += digits.repeat(repeat); repeat = 1; continue }
    if (run) runs.push(run)
    run = ''
    repeat = 1
  }
  if (run) runs.push(run)
  return runs.find((item) => item.length === 6) ?? ''
}

const YES = new Set(['yes', 'yeah', 'yep', 'yup', 'ya', 'correct', 'right', 'sure', 'ok', 'okay', 'haan', 'han', 'ha', 'haa', 'ji', 'sahi', 'theek', 'thik', 'bilkul', 'ho', 'hoy', 'barobar', 'हाँ', 'हां', 'हा', 'जी', 'सही', 'ठीक', 'बिल्कुल', 'हो', 'होय', 'बरोबर', 'चालेल'])
const NO = new Set(['no', 'nope', 'nah', 'wrong', 'incorrect', 'not', 'nahi', 'nahin', 'na', 'nako', 'galat', 'नहीं', 'नही', 'ना', 'नाही', 'नको', 'गलत', 'ग़लत', 'चूक'])

/** Reads a yes or no out of a short reply; null when it is unclear or mixed. */
export function parseYesNo(text: string): 'yes' | 'no' | null {
  const tokens = words(text)
  const yes = tokens.some((token) => YES.has(token))
  const no = tokens.some((token) => NO.has(token))
  if (yes === no) return null
  return yes ? 'yes' : 'no'
}

const DURATION = new RegExp([
  String.raw`(?:since|for|from)\s+(?:the\s+)?(?:last|past)?\s*(?:\d+|a|an|one|two|three|four|five|six|seven|few|several)?\s*(?:hours?|days?|weeks?|months?|years?)`,
  String.raw`(?:since|from)\s+(?:yesterday|last\s+\w+|morning|night|monday|tuesday|wednesday|thursday|friday|saturday|sunday)`,
  String.raw`(?:\d+|a|one|two|three|four|five|few)\s+(?:hours?|days?|weeks?|months?)`,
  String.raw`(?:\d+|एक|दो|तीन|चार|पांच|पाँच|छह|सात|आठ|नौ|दस|कुछ|कई|दोन|पाच|सहा|नऊ|दहा|काही)\s*(?:घंटे|घंटों|दिन|दिनों|हफ़्ते|हफ्ते|हफ़्तों|महीने|महीनों|तास|दिवस|दिवसांपासून|आठवडे|आठवड्यांपासून|महिने|महिन्यांपासून)(?:\s*(?:से|पासून))?`,
  String.raw`(?:कल|परसों|काल|परवा)\s*(?:से|पासून)`,
].join('|'), 'iu')

/** Picks a duration such as "for 10 days" or "दो हफ़्ते से" out of a sentence. */
export function extractDuration(text: string) {
  return text.match(DURATION)?.[0]?.trim().replace(/^for\s+/i, '') ?? ''
}

const DONT_KNOW = /(don'?t|do not)\s+know|not sure|no idea|pata\s+nahi|पता\s+नहीं|माहीत\s+नाही|माहिती\s+नाही|नक्की\s+नाही/iu

const CHANGE_TARGETS: Array<[RegExp, 'problem' | 'location' | 'duration' | 'proof']> = [
  [/problem|issue|complaint|समस्या|शिकायत|तक्रार|प्रॉब्लम/iu, 'problem'],
  [/place|location|area|address|pin|locality|landmark|जगह|पिन|इलाक|पता|ठिकाण|परिसर|पत्ता/iu, 'location'],
  [/how long|duration|time|since|days?|कब|कितने|दिन|किती|दिवस|वेळ/iu, 'duration'],
  [/proof|photo|picture|evidence|सबूत|फ़ोटो|फोटो|पुरावा|प्रमाण/iu, 'proof'],
]

// Words that carry no place name in a location reply ("yes, it's here", "no, near the school").
const FILLER = new Set(['it', 'its', "it's", 'is', 'the', 'a', 'in', 'at', 'near', 'on', 'by', 'here', 'there', 'this', 'that', 'please', 'area', 'pin', 'code', 'and', 'problem', 'place', 'location',
  'यहीं', 'यही', 'यहाँ', 'यहां', 'है', 'में', 'के', 'पास', 'पिन', 'कोड', 'इथेच', 'इथे', 'आहे', 'मध्ये', 'जवळ'])

function bare(word: string) {
  return word.toLowerCase().replace(/^[\s,.!?;:'"()।-]+|[\s,.!?;:'"()।-]+$/gu, '')
}

const TAKE_BACK = /take (?:it )?back|cancel|withdraw|delete|remove|undo|mistake|वापस|रद्द|हटा|डिलीट|कैंसल|मागे|काढून|चुकून/iu

/** Locality spoken in a location reply: the words left once yes/no, the PIN and fillers are removed. */
function localityFrom(text: string) {
  const kept = text.replace(/[०-९]/g, (d) => String('०१२३४५६७८९'.indexOf(d))).split(/\s+/).filter((word) => {
    const token = bare(word)
    return token && !/^\d+$/.test(token) && !YES.has(token) && !NO.has(token) && !FILLER.has(token) && !DIGIT_WORDS[token] && !MULTIPLIERS[token]
  })
  return kept.join(' ').replace(/^[\s,.-]+|[\s,.-]+$/g, '').slice(0, 120)
}

// ---- Speaking -----------------------------------------------------------------------

/** Spaces out digits so speech engines read a PIN one digit at a time. */
export function spokenPin(pin: string) {
  return pin.split('').join(' ')
}

/** Spells a report ID such as CC-401209-2026-5FE49A6D character by character, in groups. */
export function spellId(id: string) {
  return id.split('-').map((part) => part.split('').join(' ')).join(', ')
}

function t(state: CallState) {
  return TEXT[state.language]
}

export function summaryLine(state: CallState) {
  return t(state).summary(state.slots, spokenPin(state.slots.pin), spokenCategory(state).issue)
}

/** The question for the current stage, used to re-prompt after silence. */
export function currentQuestion(state: CallState) {
  const text = t(state)
  switch (state.stage) {
    case 'problem': return state.slots.problem ? text.retellProblem : text.greet.split(/(?<=[.?।])\s+/u).pop() ?? text.greet
    case 'location': return !state.locationSettled && state.detected ? text.askDetected(state.detected.locality, spokenPin(state.detected.pin)) : text.askLocation
    case 'pin': return text.askPin
    case 'duration': return text.askDuration
    case 'proof': return text.askProof
    case 'confirm': return confirmPrompt(state)
    case 'change': return text.askChange
    case 'failed': return text.yesNo
    case 'filed': return text.takeBackHint
    default: return ''
  }
}

function confirmPrompt(state: CallState) {
  const note = state.slots.covered === false ? ` ${t(state).notCovered(spokenPin(state.slots.pin))}` : ''
  return t(state).confirm(summaryLine(state) + note)
}

// ---- The conversation ---------------------------------------------------------------

function emptySlots(): CallSlots {
  return { problem: '', pin: '', locality: '', duration: null, proof: null, issue: '', department: '', category: '' }
}

export function startCall(language: CallLanguage, detected: CallState['detected'] = null): CallTurn {
  const state: CallState = { stage: 'problem', language, slots: emptySlots(), detected: validDetected(detected), locationSettled: false, misses: 0 }
  return { state, say: TEXT[language].greet }
}

function validDetected(detected: CallState['detected']) {
  return detected && /^\d{6}$/.test(detected.pin) && detected.locality.trim() ? detected : null
}

/** Adds device location that arrived after the call started, if it can still be offered. */
export function withDetectedLocation(state: CallState, detected: CallState['detected']): CallState {
  if (state.locationSettled || state.stage === 'location') return state
  return { ...state, detected: validDetected(detected) }
}

/** Moves to the first unanswered question, or to the read-back when everything is known. */
function advance(state: CallState, prefix = ''): CallTurn {
  const { slots } = state
  let stage: CallStage
  if (!state.locationSettled || !slots.locality) stage = 'location'
  else if (!/^\d{6}$/.test(slots.pin)) stage = 'pin'
  else if (slots.duration === null) stage = 'duration'
  else if (slots.proof === null) stage = 'proof'
  else stage = 'confirm'
  const next = { ...state, stage, misses: 0 }
  return { state: next, say: [prefix, currentQuestion(next)].filter(Boolean).join(' ') }
}

function withSlots(state: CallState, slots: Partial<CallSlots>): CallState {
  return { ...state, slots: { ...state.slots, ...slots } }
}

function retry(state: CallState, message: string): CallTurn {
  const misses = state.misses + 1
  const hint = misses >= 2 ? ` ${t(state).keypadHint}` : ''
  return { state: { ...state, misses }, say: `${message}${hint}` }
}

/** Handles what the caller said (or typed) at the current stage. */
export function handleReply(state: CallState, input: string): CallTurn {
  const text = input.trim().slice(0, 1000)
  if (!text) return handleSilence(state)
  const copy = t(state)
  switch (state.stage) {
    case 'problem': {
      if (text.length < 12 || text.split(/\s+/).length < 3) return retry(state, copy.problemShort)
      const pin = extractPin(text)
      const duration = extractDuration(text)
      const next = withSlots(state, {
        problem: text,
        ...(pin ? { pin } : {}),
        ...(duration && state.slots.duration === null ? { duration } : {}),
      })
      return { state: { ...next, misses: 0 }, say: '', action: 'classify' }
    }
    case 'location': {
      const answer = parseYesNo(text)
      const pin = extractPin(text)
      const locality = localityFrom(text)
      if (!state.locationSettled && state.detected && answer === 'yes' && !locality && !pin) {
        return advance({ ...withSlots(state, { pin: state.slots.pin || state.detected.pin, locality: state.detected.locality }), locationSettled: true })
      }
      if (answer === 'no' && !pin && !locality) {
        const next: CallState = { ...withSlots(state, { pin: '', locality: '' }), detected: null, misses: 0 }
        return { state: next, say: copy.askLocation }
      }
      if (!locality && !pin) return retry(state, copy.askLocation)
      const next = { ...withSlots(state, { ...(locality ? { locality } : {}), ...(pin ? { pin } : {}) }), locationSettled: true }
      if (!next.slots.locality) return { state: { ...next, misses: 0 }, say: copy.askLocation }
      return advance(next)
    }
    case 'pin': {
      const pin = extractPin(text)
      if (!pin) return retry(state, copy.pinInvalid)
      return advance(withSlots(state, { pin }))
    }
    case 'duration': {
      const duration = DONT_KNOW.test(text) ? '' : extractDuration(text) || text.slice(0, 60)
      return advance(withSlots(state, { duration }))
    }
    case 'proof': {
      const answer = parseYesNo(text)
      if (!answer) return retry(state, copy.yesNo)
      return advance(withSlots(state, { proof: answer === 'yes' }))
    }
    case 'confirm': {
      const answer = parseYesNo(text)
      if (answer === 'yes') return { state: { ...state, stage: 'filing', misses: 0 }, say: copy.filing, action: 'file' }
      // A correction spoken straight away ("no, the PIN is 401209") is applied and read back again.
      const pin = extractPin(text)
      if (pin && pin !== state.slots.pin) return advance({ ...withSlots(state, { pin, covered: undefined }) })
      if (answer === 'no') return { state: { ...state, stage: 'change', misses: 0 }, say: copy.askChange }
      return changeTarget(state, text) ?? retry(state, copy.yesNo)
    }
    case 'change':
      return changeTarget(state, text) ?? retry(state, copy.changeUnknown)
    case 'failed': {
      const answer = parseYesNo(text)
      if (answer === 'yes') return { state: { ...state, stage: 'filing', misses: 0 }, say: copy.filing, action: 'file' }
      if (answer === 'no') return { state: { ...state, stage: 'done' }, say: '', action: 'hangup' }
      return retry(state, copy.yesNo)
    }
    case 'filed':
      // After filing, the caller can still take the complaint back; anything else ends the call.
      if (TAKE_BACK.test(text)) return { state: { ...state, stage: 'done', misses: 0 }, say: copy.withdrawing, action: 'withdraw' }
      return { state: { ...state, stage: 'done' }, say: copy.goodbye, action: 'hangup' }
    default:
      return { state, say: '' }
  }
}

function changeTarget(state: CallState, text: string): CallTurn | null {
  const target = CHANGE_TARGETS.find(([pattern]) => pattern.test(text))?.[1]
  const copy = t(state)
  if (target === 'problem') return { state: { ...state, stage: 'problem', misses: 0 }, say: copy.retellProblem }
  if (target === 'location') return { state: { ...withSlots(state, { pin: '', locality: '', covered: undefined }), stage: 'location', detected: null, locationSettled: false, misses: 0 }, say: copy.askLocation }
  if (target === 'duration') return { state: { ...withSlots(state, { duration: null }), stage: 'duration', misses: 0 }, say: copy.askDuration }
  if (target === 'proof') return { state: { ...withSlots(state, { proof: null }), stage: 'proof', misses: 0 }, say: copy.askProof }
  return null
}

/** Keypad (DTMF) input: a PIN at the location/PIN step, 1 = yes and 2 = no elsewhere. */
export function handleDigits(state: CallState, digits: string): CallTurn {
  const copy = t(state)
  if (state.stage === 'location' || state.stage === 'pin') {
    if (!/^\d{6}$/.test(digits)) return retry(state, copy.pinInvalid)
    const next = { ...withSlots(state, { pin: digits, covered: undefined }), locationSettled: true }
    if (!next.slots.locality) {
      const locality = state.detected && state.detected.pin === digits ? state.detected.locality : ''
      if (!locality) return { state: { ...next, stage: 'location', misses: 0 }, say: copy.askLocation }
      return advance(withSlots(next, { locality }))
    }
    return advance(next)
  }
  if (['proof', 'confirm', 'failed'].includes(state.stage)) {
    if (digits === '1') return handleReply(state, 'yes')
    if (digits === '2') return handleReply(state, 'no')
    return retry(state, copy.yesNo)
  }
  return retry(state, currentQuestion(state))
}

export function handleSilence(state: CallState): CallTurn {
  if (state.stage === 'filed') return { state: { ...state, stage: 'done' }, say: t(state).goodbye, action: 'hangup' }
  return retry(state, `${t(state).notHeard} ${currentQuestion(state)}`)
}

/** Continues after the complaint text was classified. */
export function afterClassify(state: CallState, analysis: { issue: string; department: string; category?: string; jurisdiction?: { level: string; ruleId: string } }): CallTurn {
  const next = withSlots(state, { issue: analysis.issue, department: analysis.department, category: analysis.category ?? '' })
  const spoken = spokenCategory(next)
  const beyond = analysis.jurisdiction && analysis.jurisdiction.level !== 'local' ? BEYOND_LOCAL[state.language][analysis.jurisdiction.ruleId] : undefined
  const note = beyond ? ` ${beyond} ${BEYOND_LOCAL[state.language].suffix}` : ''
  return advance(next, t(state).ack(spoken.issue, spoken.department) + note)
}

/** Records whether an authority covers the PIN; refreshes the read-back if it is pending. */
export function withCoverage(state: CallState, pin: string, covered: boolean | null): CallState {
  return state.slots.pin === pin ? withSlots(state, { covered }) : state
}

/** Reads the report ID back twice, then gives the caller a moment to take it back. */
export function afterFiled(state: CallState, documentId: string): CallTurn {
  return { state: { ...state, stage: 'filed', misses: 0 }, say: t(state).filed(spellId(documentId)) }
}

export function afterWithdrawn(state: CallState, outcome: 'deleted' | 'withdrawn'): CallTurn {
  return { state: { ...state, stage: 'done' }, say: t(state).withdrawn(outcome === 'deleted'), action: 'hangup' }
}

export function afterWithdrawFailed(state: CallState, reason: string): CallTurn {
  return { state: { ...state, stage: 'done' }, say: t(state).withdrawFailed(reason), action: 'hangup' }
}

/** Offline: the complaint was kept as an on-device draft, so the call closes. */
export function afterDraftSaved(state: CallState): CallTurn {
  return { state: { ...state, stage: 'done' }, say: t(state).saved, action: 'hangup' }
}

export function afterFileFailed(state: CallState, reason: string): CallTurn {
  return { state: { ...state, stage: 'failed', misses: 0 }, say: t(state).failed(reason) }
}

/** True while the agent expects the caller to answer. */
export function awaitingCaller(state: CallState) {
  return !['filing', 'done'].includes(state.stage)
}
