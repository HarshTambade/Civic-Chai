export type LanguageCode = 'en' | 'hi' | 'mr'

export const languageOptions = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'हिन्दी' },
  { code: 'mr', label: 'मराठी' },
] as const

export type TranslationDictionary = {
  nav: {
    localChai: string
    howItWorks: string
    chaiTapri: string
    authorityLogin: string
    about: string
    startCharcha: string
  }
  hero: {
    badge: string
    title: string
    description: string
    ctaPrimary: string
    ctaSecondary: string
    cities: string
    issuesResolved: string
    languages: string
  }
  sections: {
    whatIsEyebrow: string
    whatIsTitle: string
    whatIsSubtitle: string
    howEyebrow: string
    howTitle: string
    howSubtitle: string
    finalEyebrow: string
    finalTitle: string
    finalSubtitle: string
    finalCta: string
  }
  footer: {
    product: string
    authorities: string
    about: string
    tag: string
  }
  aboutPage: {
    eyebrow: string
    title: string
    subtitle: string
    ctaPrimary: string
    ctaSecondary: string
    why: string
    community: string
    communityText: string
    finalTitle: string
    finalCta: string
    pillars: { title: string; description: string }[]
    stats: { label: string; value: string }[]
  }
  howPage: {
    eyebrow: string
    title: string
    subtitle: string
    stepTitles: string[]
    stepDescriptions: string[]
    civicIntelligence: string
    civicIntelligenceTitle: string
    civicIntelligenceText: string
    summary: string
    summaryCta: string
  }
  citizenApp: {
    offline: string
    title: string
    subtitle: string
    primary: string
    secondary: string
    yourChai: string
    feed: string
    feedText: string
    trending: string
    trendingText: string
    discussions: string
    profile: string
    profileText: string
    tabs: string[]
  }
  aiShowcase: {
    eyebrow: string
    title: string
    supportText: string
    duplicateEyebrow: string
    duplicateTitle: string
    duplicateText: string
    duplicateNote: string
    prompt: string
  }
  tapriPage: {
    eyebrow: string
    title: string
    subtitle: string
    trendingLabel: string
    trendTitle: string
    realTimeSignal: string
    heat: string
    cards: { title: string; text: string }[]
    cta: string
  }
  landing: {
    whatIsCards: { title: string; description: string }[]
    howFlow: string[]
    channels: { title: string; description: string }[]
    channelEyebrow: string
    channelTitle: string
    channelSubtitle: string
    channelFooter: string
    finalTitle: string
    finalSubtitle: string
    finalCta: string
  }
}

export const translations: Record<LanguageCode, TranslationDictionary> = {
  en: {
    nav: {
      localChai: 'Local Chai',
      howItWorks: 'How it Works',
      chaiTapri: 'Chai Tapri',
      authorityLogin: 'Authority Login',
      about: 'About',
      startCharcha: 'Start a Charcha',
    },
    hero: {
      badge: 'India\'s civic social network',
      title: 'India mein har ek Charcha Chai Pe hoti hai.',
      description:
        'Ab mohalla ki baat sirf tapri tak nahi. Report karo. Charcha karo. Vote karo. Aur dekho tumhari awaaz kahan tak pahunchti hai.',
      ctaPrimary: 'Start a Charcha',
      ctaSecondary: 'Explore Chai Tapri',
      cities: 'Cities ki charcha',
      issuesResolved: 'Issues resolved',
      languages: 'Languages',
    },
    sections: {
      whatIsEyebrow: 'What is CivicChai?',
      whatIsTitle: 'CivicChai turns everyday civic problems into community discussions.',
      whatIsSubtitle:
        'It is not just a complaint portal. It is the tapri where your mohalla gathers — report an issue, discuss it, support it, and follow it all the way to government action.',
      howEyebrow: 'How CivicChai works',
      howTitle: 'Se ek cup chai se civic action tak.',
      howSubtitle:
        'From a social post to an official civic case file — here is the journey every Charcha takes.',
      finalEyebrow: 'From Charcha to Action',
      finalTitle: 'The CivicChai Control Room.',
      finalSubtitle:
        'Authorities get a clean, dense operations dashboard — priority that combines severity, persistence, evidence and community support, not just raw votes. Every sensitive action is auditable.',
      finalCta: 'Open the Control Room',
    },
    footer: {
      product: 'Product',
      authorities: 'Authorities',
      about: 'About',
      tag: 'चाय · चर्चा · बदलाव',
    },
    aboutPage: {
      eyebrow: 'About CivicChai',
      title: 'A digital chai tapri for civic life.',
      subtitle:
        'CivicChai is a community-powered civic platform that helps citizens raise issues, support the problems that matter, and push them toward resolution without the usual confusion and bureaucracy.',
      ctaPrimary: 'Start a Charcha',
      ctaSecondary: 'View Control Room',
      why: 'Why it exists',
      community: 'Community-driven visibility',
      communityText:
        'The more people support a problem, the more heat it gains. That visibility helps communities and officials focus on the issues that matter most in real time.',
      finalTitle: 'We believe every neighborhood should have a simple way to turn concern into action.',
      finalCta: 'See how it works',
      pillars: [
        { title: 'Charcha-first civic culture', description: 'CivicChai treats everyday problems as public conversations, not just anonymous complaints. Citizens can speak up, support others, and see momentum build around real issues.' },
        { title: 'AI built for Indian languages', description: 'People report issues in English, Hindi, Marathi, Hinglish, and other natural expressions. The AI understands the intent and turns it into a structured civic case.' },
        { title: 'A direct line to the right office', description: 'Each issue is mapped to the relevant department and hub, so action happens without losing context or being buried under noise.' },
        { title: 'Transparent and accountable', description: 'Every update is traceable. Officials see priority, evidence, and community backing in one place, with a clear audit trail for each decision.' },
      ],
      stats: [
        { label: 'Cities in network', value: '120+' },
        { label: 'Issues resolved', value: '18.4k' },
        { label: 'Public support', value: '6.7M' },
        { label: 'Avg. routing time', value: '< 3 hrs' },
      ],
    },
    howPage: {
      eyebrow: 'How it works',
      title: 'From a neighbourhood concern to civic action.',
      subtitle: 'CivicChai keeps the journey simple: report, understand, validate, support, and resolve. The platform is designed to move from local chatter to actual public accountability.',
      stepTitles: ['Capture', 'Describe', 'AI inference', 'Validate', 'Community support', 'Heat grows', 'Department action', 'Resolution'],
      stepDescriptions: ['A resident spots a problem and reports it in a few taps or by voice.', 'The issue is interpreted in natural language, including Hindi, Marathi, Hinglish, and more.', 'The platform classifies the category, suggests the right department, and flags duplicates.', 'The citizen can confirm the match, strengthen an existing issue, or create a new one.', 'Neighbours add signals through comments, support, and shared context that increase visibility.', 'The issue gains traction and becomes a visible civic priority across the local network.', 'The municipal team or authority receives a clean, structured case passed through the right workflow.', 'Status and outcome updates are tracked so citizens can see the issue move from concern to action.'],
      civicIntelligence: 'Civic intelligence',
      civicIntelligenceTitle: 'Smart routing, not chaotic filing.',
      civicIntelligenceText: 'The system uses semantic matching, location signals, and support patterns to decide whether a problem is new, already active, or should be merged into an existing community report. This reduces duplicate work while still giving people a voice.',
      summary: 'The goal is not just reporting. It is movement, visibility, and accountability.',
      summaryCta: 'Try the civic feed',
    },
    citizenApp: {
      offline: 'Offline ready',
      title: 'Your Local Chai',
      subtitle: 'Your locality civic feed. Report, discuss and support issues in your neighbourhood. Every charcha starts with a cup of chai.',
      primary: 'Pour a Chai — Start your Charcha',
      secondary: 'View Chai Tapri',
      yourChai: 'Your Chai',
      feed: 'Feed',
      feedText: 'Issues in your locality',
      trending: 'Trending',
      trendingText: 'Chai Tapri — Hottest issues',
      discussions: 'Your Discussions',
      profile: 'Your Profile',
      profileText: 'Manage your account, preferences and civic impact.',
      tabs: ['Local Chai', 'Chai Tapri', 'My Charcha', 'Profile'],
    },
    aiShowcase: {
      eyebrow: 'AI that understands your complaint',
      title: 'Bolo kisi bhi bhasha mein. AI sab samajh leta hai.',
      supportText: 'AI ne problem samajh li',
      duplicateEyebrow: 'Don\'t file the same complaint twice',
      duplicateTitle: 'Arre, yeh Chai pehle se chal rahi hai!',
      duplicateText: 'Before you file, CivicChai looks for similar reports in the same PIN by comparing wording, locality and category. Instead of a lonely new complaint, you can add your weight to one that\'s already gaining heat.',
      duplicateNote: 'We never reject you. You always choose: support the existing Charcha, or mark it as a genuinely different problem.',
      prompt: 'Is Charcha ko Support Karo',
    },
    tapriPage: {
      eyebrow: 'Chai Tapri',
      title: 'Dekho kis mudde ki chai sabse garam hai.',
      subtitle: 'Issues rise in public visibility based on urgency, recurrence, community support, and the intensity of action around them — not just raw votes alone.',
      trendingLabel: 'Trending this week',
      trendTitle: 'Local heat map of reform priorities',
      realTimeSignal: 'Real-time signal',
      heat: 'Heat',
      cards: [
        { title: 'Public urgency', text: 'The more people feel the problem, the more visible it becomes.' },
        { title: 'Actionable momentum', text: 'Repeated reports and support create clarity for authorities.' },
        { title: 'Follow through', text: 'Issues can be strengthened, resolved, or revisited with full context.' },
      ],
      cta: 'Join the Charcha',
    },
    landing: {
      whatIsCards: [
        { title: 'Charcha, not complaints', description: 'Every issue is a conversation your neighbours can join, support and shape.' },
        { title: 'AI that understands you', description: 'Type or speak in Hindi, Marathi, English or Hinglish — the AI gets it.' },
        { title: 'Straight to the right desk', description: 'Issues are routed to the correct department, officer and municipal hub.' },
      ],
      howFlow: ['Scan', 'Report', 'AI understands', 'Duplicate check', 'Community votes', 'Chai gets hotter', 'Department action', 'Track resolution'],
      channels: [
        { title: 'Smartphone', description: 'Speak your problem — voice becomes a structured complaint.' },
        { title: 'Keypad phone', description: 'Just call CivicChai. A voice agent files it for you, DTMF fallback included.' },
        { title: 'Web', description: 'Type it out in your language on any browser, even a shared device.' },
      ],
      channelEyebrow: 'Works even without a smartphone',
      channelTitle: 'Har awaaz maayne rakhti hai.',
      channelSubtitle: 'Smartphone, keypad phone ya web — a voice agent and AI turn every channel into the same civic issue.',
      channelFooter: 'Voice Agent → AI → Complaint, in your language.',
      finalTitle: 'Har mohalla ki ek Chai hoti hai. Har Chai ki ek Charcha hoti hai. Aur har Charcha se badlav shuru ho sakta hai.',
      finalSubtitle: 'Chai thandi hone se pehle, baat ko aage badhao.',
      finalCta: 'Start Your Charcha',
    },
  },
  hi: {
    nav: {
      localChai: 'लोकल चाय',
      howItWorks: 'यह कैसे काम करता है',
      chaiTapri: 'चाय Tapri',
      authorityLogin: 'अधिकारी लॉगिन',
      about: 'हमारे बारे में',
      startCharcha: 'चर्चा शुरू करें',
    },
    hero: {
      badge: 'भारत की नागरिक सोशल नेटवर्क',
      title: 'भारत में हर एक चर्चा चाय पे होती है।',
      description:
        'अब मोहल्ले की बात सिर्फ Tapri तक नहीं. रिपोर्ट करो. चर्चा करो. वोट करो. और देखो तुम्हारी आवाज़ कहाँ तक पहुँचती है.',
      ctaPrimary: 'चर्चा शुरू करें',
      ctaSecondary: 'चाय Tapri देखें',
      cities: 'शहरों की चर्चा',
      issuesResolved: 'सुलझे मुद्दे',
      languages: 'भाषाएँ',
    },
    sections: {
      whatIsEyebrow: 'CivicChai क्या है?',
      whatIsTitle: 'CivicChai रोज़मर्रा के नागरिक मुद्दों को समुदाय चर्चा में बदलता है।',
      whatIsSubtitle:
        'यह सिर्फ एक शिकायत पोर्टल नहीं है. यह वह tapri है जहाँ आपका मोहल्ला इकट्ठा होता है — किसी समस्या की रिपोर्ट करो, चर्चा करो, सपोर्ट करो और इसे सरकार की कार्रवाई तक ले जाओ.',
      howEyebrow: 'CivicChai कैसे काम करता है',
      howTitle: 'एक कप चाय से नागरिक कार्रवाई तक।',
      howSubtitle:
        'एक सोशल पोस्ट से लेकर आधिकारिक नागरिक केस फाइल तक — यही है हर चर्चा की यात्रा।',
      finalEyebrow: 'चर्चा से कार्रवाई तक',
      finalTitle: 'CivicChai कंट्रोल रूम।',
      finalSubtitle:
        'अधिकारी एक साफ़, गहन ऑपरेशन डैशबोर्ड देखते हैं — तीव्रता, स्थिरता, सबूत और समुदाय का समर्थन मिलकर प्राथमिकता तय करता है। हर संवेदनशील कार्य ऑडिटेबल होता है।',
      finalCta: 'कंट्रोल रूम खोलें',
    },
    footer: {
      product: 'प्रोडक्ट',
      authorities: 'अधिकारियाँ',
      about: 'हमारे बारे में',
      tag: 'चाय · चर्चा · बदलाव',
    },
    aboutPage: {
      eyebrow: 'CivicChai के बारे में',
      title: 'नागरिक जीवन के लिए डिजिटल चाय Tapri.',
      subtitle: 'CivicChai एक सामुदायिक नागरिक प्लेटफ़ॉर्म है जो नागरिकों को समस्याएँ उठाने, उनके महत्व को समझने और बिना अड़चन के समाधान तक पहुँचने में मदद करता है।',
      ctaPrimary: 'चर्चा शुरू करें',
      ctaSecondary: 'कंट्रोल रूम देखें',
      why: 'यह क्यों है',
      community: 'सामुदायिक दृश्यता',
      communityText: 'जितना ज़्यादा लोग किसी समस्या का समर्थन करेंगे, उतना ही उसका Heat बढ़ेगा। यह दृश्यता समुदायों और अधिकारियों को सबसे महत्वपूर्ण मुद्दों पर ध्यान केंद्रित करने में मदद करती है।',
      finalTitle: 'हम मानते हैं कि हर पड़ोस को चिंता को कार्रवाई में बदलने का एक सरल तरीका चाहिए।',
      finalCta: 'यह कैसे काम करता है देखें',
      pillars: [
        { title: 'चर्चा-प्रथम नागरिक संस्कृति', description: 'CivicChai रोज़मर्रा की समस्याओं को केवल अज्ञात शिकायतों के बजाय सार्वजनिक बातचीत के रूप में देखता है।' },
        { title: 'भारतीय भाषाओं के लिए AI', description: 'लोग अंग्रेज़ी, हिन्दी, मराठी, Hinglish और अन्य स्वाभाविक भाषाओं में समस्या रिपोर्ट करते हैं। AI उनका मतलब समझकर संरचित नागरिक मामला बनाता है।' },
        { title: 'सही कार्यालय तक सीधा रास्ता', description: 'हर मुद्दे को सही विभाग और हब से जोड़ दिया जाता है ताकि संदर्भ खोए बिना कार्रवाई हो सके।' },
        { title: 'पारदर्शी और ज़िम्मेदार', description: 'हर अपडेट ट्रैक करने योग्य होता है। अधिकारी एक ही जगह प्राथमिकता, सबूत और सामुदायिक समर्थन देखते हैं।' },
      ],
      stats: [
        { label: 'नेटवर्क में शहर', value: '120+' },
        { label: 'सुलझे मुद्दे', value: '18.4k' },
        { label: 'सार्वजनिक सहयोग', value: '6.7M' },
        { label: 'औसत रूटिंग समय', value: '< 3 hrs' },
      ],
    },
    howPage: {
      eyebrow: 'यह कैसे काम करता है',
      title: 'एक पड़ोस की चिंता से नागरिक कार्रवाई तक।',
      subtitle: 'CivicChai यात्रा को सरल रखता है: रिपोर्ट करें, समझें, सत्यापित करें, समर्थन दें, और समाधान करें।',
      stepTitles: ['कैप्चर', 'विवरण', 'AI फ़ीडबैक', 'सत्यापन', 'सामुदायिक समर्थन', 'Heat बढ़ता है', 'विभाग कार्रवाई', 'समाधान'],
      stepDescriptions: ['एक निवासी कुछ टैप्स या आवाज़ से समस्या रिपोर्ट करता है।', 'मुद्दा प्राकृतिक भाषा में समझा जाता है, जिसमें हिन्दी, मराठी, Hinglish और अधिक शामिल हैं।', 'प्लेटफ़ॉर्म कैटेगरी का वर्गीकरण करता है, सही विभाग सुझाता है और डुप्लिकेट पहचानता है।', 'नागरिक मिलान की पुष्टि कर सकता है, मौजूदा मुद्दे को मजबूत कर सकता है या नया बन सकता है।', 'पड़ोसी कमेंट, सपोर्ट और साझा संदर्भ से दृश्यता बढ़ाते हैं।', 'मुद्दा traction पकड़ता है और स्थानीय नेटवर्क में एक प्रमुख नागरिक मुद्दा बन जाता है।', 'नगरपालिका टीम या अधिकारी सही वर्कफ़्लो से साफ़ संरचित केस प्राप्त करता है।', 'स्थिति और परिणाम अपडेट ट्रैक किए जाते हैं ताकि नागरिक देख सकें कि समस्या चिंता से कार्रवाई तक कैसे आगे बढ़ी।'],
      civicIntelligence: 'नागरिक इन्टेलिजेंस',
      civicIntelligenceTitle: 'अव्यवस्थित फाइलिंग नहीं, स्मार्ट रूटिंग।',
      civicIntelligenceText: 'सिस्टम सेमांटिक मैचिंग, लोकेशन सिग्नल और सपोर्ट पैटर्न के आधार पर तय करता है कि समस्या नई है, पहले से सक्रिय है, या मौजूदा रिपोर्ट में merge करनी है।',
      summary: 'लक्ष्य सिर्फ रिपोर्ट करना नहीं है। यह गति, दृश्यता और जवाबदेही है।',
      summaryCta: 'सिविल फीड देखें',
    },
    citizenApp: {
      offline: 'ऑफलाइन तैयार',
      title: 'तुम्हारा लोकल चाय',
      subtitle: 'तुम्हारा स्थानीय नागरिक फीड. समस्या रिपोर्ट करो, चर्चा करो और सहयोग करो. हर चर्चा की शुरुआत एक कप चाय से होती है.',
      primary: 'चाय डालें — अपनी चर्चा शुरू करें',
      secondary: 'चाय Tapri देखें',
      yourChai: 'तुम्हारी चाय',
      feed: 'फीड',
      feedText: 'आपके इलाके के मुद्दे',
      trending: 'ट्रेंडिंग',
      trendingText: 'चाय Tapri — सबसे गर्म मुद्दे',
      discussions: 'तुम्हारी चर्चाएँ',
      profile: 'प्रोफ़ाइल',
      profileText: 'अपना अकाउंट, पसंदीदा और नागरिक प्रभाव प्रबंधित करें।',
      tabs: ['लोकल चाय', 'चाय Tapri', 'मेरा चर्चा', 'प्रोफ़ाइल'],
    },
    aiShowcase: {
      eyebrow: 'AI आपकी शिकायत को समझता है',
      title: 'किसी भी भाषा में बोलें. AI सब समझ लेता है.',
      supportText: 'AI ने समस्या समझ ली',
      duplicateEyebrow: 'एक ही शिकायत दो बार न करें',
      duplicateTitle: 'अरे, यह चाय पहले से चल रही है!',
      duplicateText: 'शिकायत दर्ज करने से पहले CivicChai उसी PIN में शब्दों, इलाके और श्रेणी की तुलना करके मिलती-जुलती रिपोर्ट दिखाता है।',
      duplicateNote: 'हम आपको कभी अस्वीकार नहीं करते. आप हमेशा चुनते हैं: मौजूदा चर्चा का समर्थन करें या अलग समस्या बताएं।',
      prompt: 'इस चर्चा का समर्थन करें',
    },
    tapriPage: {
      eyebrow: 'चाय Tapri',
      title: 'देखिए किस मुद्दे की चाय सबसे गरम है।',
      subtitle: 'मुद्दे सार्वजनिक दृश्यता में उभरते हैं, जो तात्कालिकता, दोहराव, सामुदायिक समर्थन और कार्रवाई की तीव्रता पर आधारित होते हैं — सिर्फ़ वोटों के आधार पर नहीं।',
      trendingLabel: 'इस सप्ताह ट्रेंडिंग',
      trendTitle: 'सुधार प्राथमिकताओं का लोकल हीट मैप',
      realTimeSignal: 'रियल-टाइम संकेत',
      heat: 'हीट',
      cards: [
        { title: 'लोकल तात्कालिकता', text: 'जितने ज़्यादा लोग समस्या महसूस करते हैं, उतनी ही अधिक वह दिखाई देने लगती है।' },
        { title: 'कार्रवाई योग्य गति', text: 'दोहराई गई रिपोर्ट्स और समर्थन अधिकारियों के लिए स्पष्टता बनाते हैं।' },
        { title: 'निरंतरता', text: 'मुद्दे को मजबूत किया जा सकता है, हल किया जा सकता है, या पूरे संदर्भ के साथ फिर से देखा जा सकता है।' },
      ],
      cta: 'चर्चा में शामिल हों',
    },
    landing: {
      whatIsCards: [
        { title: 'चर्चा, शिकायत नहीं', description: 'हर मुद्दा एक ऐसी बातचीत है जिसमें आपके पड़ोसी जुड़ सकें, उसका समर्थन कर सकें और उसे आकार दे सकें।' },
        { title: 'AI जो आपको समझे', description: 'हिंदी, मराठी, अंग्रेज़ी या Hinglish में लिखें या बोलें — AI समझ लेता है।' },
        { title: 'सही दफ्तर तक सीधे', description: 'मुद्दे सही विभाग, अधिकारी और नगर हब तक रूट हो जाते हैं।' },
      ],
      howFlow: ['स्कैन', 'रिपोर्ट', 'AI समझता है', 'डुप्लिकेट चेक', 'कम्युनिटी वोट्स', 'चाय गरम होती है', 'विभाग कार्रवाई', 'रिज़ॉल्यूशन ट्रैक'],
      channels: [
        { title: 'स्मार्टफोन', description: 'अपनी परेशानी बोलें — आवाज़ स्ट्रक्चर्ड शिकायत बन जाती है।' },
        { title: 'कीपैड फोन', description: 'बस CivicChai को कॉल करें. वॉइस एजेंट आपके लिए फाइल कर देता है, DTMF fallback भी शामिल है।' },
        { title: 'वेब', description: 'अपनी भाषा में लिखें, किसी भी ब्राउज़र में, यहाँ तक कि साझा डिवाइस पर भी।' },
      ],
      channelEyebrow: 'स्मार्टफोन के बिना भी काम करता है',
      channelTitle: 'हर आवाज़ का मतलब रखती है।',
      channelSubtitle: 'स्मार्टफोन, कीपैड फोन या वेब — वॉइस एजेंट और AI हर चैनल को एक ही नागरिक समस्या में बदल देते हैं।',
      channelFooter: 'वॉइस एजेंट → AI → शिकायत, आपकी भाषा में।',
      finalTitle: 'हर मोहल्ले की एक चाय होती है. हर चाय की एक चर्चा होती है. और हर चर्चा से बदलाव शुरू हो सकता है.',
      finalSubtitle: 'चाय ठंडी होने से पहले, बात को आगे बढ़ाइए.',
      finalCta: 'अपनी चर्चा शुरू करें',
    },
  },
  mr: {
    nav: {
      localChai: 'लोकल चहा',
      howItWorks: 'हे कसे काम करते?',
      chaiTapri: 'चहा Tapri',
      authorityLogin: 'अधिकारी लॉगिन',
      about: 'About',
      startCharcha: 'चर्चा सुरू करा',
    },
    hero: {
      badge: 'भारताची नागरी सोशल नेटवर्क',
      title: 'भारतामध्ये प्रत्येक चर्चा चहावर होते.',
      description:
        'आता मॉलचा आवाजा फक्त tapri पर्यंत मर्यादित नाही. तक्रार करा. चर्चा करा. मत द्या. आणि पाहा तुमचा आवाज कोठेपर्यंत पोहोचतो.',
      ctaPrimary: 'चर्चा सुरू करा',
      ctaSecondary: 'चहा Tapri पहा',
      cities: 'शहरांची चर्चा',
      issuesResolved: 'निराकरण झालेले विषय',
      languages: 'भाषा',
    },
    sections: {
      whatIsEyebrow: 'CivicChai म्हणजे काय?',
      whatIsTitle: 'CivicChai रोजच्या नागरी समस्यांना समुदाय चर्चेमध्ये बदलतो.',
      whatIsSubtitle:
        'हे फक्त तक्रार पोर्टल नाही. हे ते tapri आहे जिथे तुमचा मोहल्ला एकत्र येतो — समस्या नोंदवा, चर्चा करा, पाठिंबा द्या आणि ती सरकारच्या कारवाईपर्यंत नेवा.',
      howEyebrow: 'CivicChai कसे काम करते',
      howTitle: 'एका कप चहापासून नागरी कारवाईपर्यंत.',
      howSubtitle:
        'सोशल पोस्टपासून अधिकृत नागरी प्रकरणापर्यंत — प्रत्येक चर्चेची ही यात्रा आहे.',
      finalEyebrow: 'चर्चेपासून कारवाईपर्यंत',
      finalTitle: 'CivicChai कंट्रोल रूम.',
      finalSubtitle:
        'अधिकारी स्वच्छ, सघन ऑपरेशन ডॅशबोर्ड पाहतात — ताण, टिकाऊपणा, पुरावे आणि समुदायाचा पाठिंबा यांचा समावेश असलेली प्राथमिकता. प्रत्येक संवेदनशील कृती ऑडिटेबल असते.',
      finalCta: 'कंट्रोल रूम उघडा',
    },
    footer: {
      product: 'प्रोडक्ट',
      authorities: 'अधिकारी',
      about: 'आमच्याबद्दल',
      tag: 'चहा · चर्चा · बदल',
    },
    aboutPage: {
      eyebrow: 'CivicChai बद्दल',
      title: 'नागरिक जीवनासाठी डिजिटल चहा Tapri.',
      subtitle: 'CivicChai हे सामुदायिक नागरिक प्लॅटफॉर्म आहे जे नागरिकांना समस्या उचलण्यास, महत्त्वाच्या मुद्द्यांवर पाठिंबा देण्यास आणि पारदर्शक पद्धतीने निराकरणाकडे नेण्यास मदत करते.',
      ctaPrimary: 'चर्चा सुरू करा',
      ctaSecondary: 'कंट्रोल रूम पहा',
      why: 'हे का आवश्यक आहे',
      community: 'सामुदायिक दृश्यता',
      communityText: 'जितके जास्त लोक एखाद्या समस्येला पाठिंबा देतात, तितकी ती गरम होते. ही दृश्यता समुदायांना आणि अधिकाऱ्यांना महत्त्वाच्या मुद्द्यांवर लक्ष केंद्रित करण्यास मदत करते.',
      finalTitle: 'आम्हाला विश्वास आहे की प्रत्येक पेठेला चिंता काढून कृतीत बदलण्याचा सोपा मार्ग हवा.',
      finalCta: 'हे कसे काम करते ते पहा',
      pillars: [
        { title: 'चर्चा-प्रथम नागरी संस्कृती', description: 'CivicChai रोजच्या समस्यांना केवळ गुप्त तक्रारी नव्हे तर सार्वजनिक चर्चांमध्ये रूपांतरित करते.' },
        { title: 'भारतीय भाषांमध्ये AI', description: 'लोक इंग्रजी, हिंदी, मराठी, Hinglish आणि इतर नैसर्गिक भाषांमध्ये तक्रार देतात. AI अर्थ समजून स्पष्ट नागरी प्रकरण तयार करते.' },
        { title: 'सही कार्यालयाकडे सरळ दुवा', description: 'प्रत्येक मुद्दा योग्य विभाग आणि हबशी जुळवला जातो, त्यामुळे संदर्भ न गमावता कृती होते.' },
        { title: 'पारदर्शक आणि जवाबदार', description: 'हर अपडेट ट्रॅक करता येतो. अधिकारी एकाच ठिकाणी प्राथमिकता, पुरावे आणि समुदायाचा पाठिंबा पाहू शकतात.' },
      ],
      stats: [
        { label: 'नेटवर्कमध्ये शहरे', value: '120+' },
        { label: 'निराकरण झालेले मुद्दे', value: '18.4k' },
        { label: 'सार्वजनिक पाठिंबा', value: '6.7M' },
        { label: 'सरासरी रूटिंग वेळ', value: '< 3 hrs' },
      ],
    },
    howPage: {
      eyebrow: 'हे कसे काम करते',
      title: 'पड़ोसीच्या चिंता पासून नागरी कृतीपर्यंत.',
      subtitle: 'CivicChai प्रवाह सोपा ठेवतो: रिपोर्ट करा, समजून घ्या, तपासणी करा, पाठिंबा द्या आणि निराकरण करा.',
      stepTitles: ['कॅप्चर', 'वर्णन', 'AI अंतर्दृष्टी', 'सत्यापन', 'सामुदायिक पाठिंबा', 'Heat वाढतो', 'विभाग कृती', 'निराकरण'],
      stepDescriptions: ['निवासी थोड्या टॅप्स किंवा आवाजातून समस्या नोंदवतो.', 'मुद्दा नैसर्गिक भाषेमध्ये समजतो, ज्यामध्ये हिंदी, मराठी, Hinglish आणि इतर समाविष्ट असतात.', 'प्लॅटफॉर्म श्रेणी ओळखतो, योग्य विभाग सुचवतो आणि डुप्लिकेट ओळखतो.', 'नागरिक जुळणीची पुष्टी करू शकतो, विद्यमान मुद्दा मजबूत करू शकतो किंवा नवीन तयार करू शकतो.', 'शेजारील लोक टिप्पण्या, पाठिंबा आणि सामायिक संदर्भाद्वारे दृश्यता वाढवतात.', 'मुद्दा ट्रॅक घेतो आणि स्थानिक नेटवर्कमध्ये एक प्रमुख नागरी मुद्दा बनतो.', 'नगरपालिका टीम किंवा अधिकारी योग्य वर्कफ्लोमधून स्वच्छ संरचित केस प्राप्त करतात.', 'स्थिती आणि परिणाम अपडेट ट्रॅक केले जातात जेणेकरून नागरिक पाहू शकतील की समस्या चिंता पासून कृतीपर्यंत कशी पुढे गेली.'],
      civicIntelligence: 'नागरिक बुद्धिमत्ता',
      civicIntelligenceTitle: 'अराजक फाइलिंग नाही, स्मार्ट रूटिंग.',
      civicIntelligenceText: 'सिस्टम सेमांटिक मॅचिंग, लोकेशन संकेत आणि पाठिंब्याच्या नमुन्यांवर आधारित ठरवते की समस्या नवीन आहे, आधीपासून सक्रिय आहे, किंवा विद्यमान रिपोर्टमध्ये merge करावी.',
      summary: 'लक्ष्य फक्त रिपोर्ट नाही. हे गती, दृश्यता आणि जवाबदारी आहे.',
      summaryCta: 'नागरी फीड पहा',
    },
    citizenApp: {
      offline: 'ऑफलाइन तयार',
      title: 'तुमचा लोकल चहा',
      subtitle: 'तुमचा स्थानिक नागरिक फीड. समस्या नोंदवा, चर्चा करा आणि पाठिंबा द्या. प्रत्येक चर्चेची सुरुवात एक कप चहाने होते.',
      primary: 'चहा पिला — तुमची चर्चा सुरू करा',
      secondary: 'चहा Tapri पहा',
      yourChai: 'तुमचा चहा',
      feed: 'फीड',
      feedText: 'तुमच्या परिसरातील मुद्दे',
      trending: 'ट्रेंडिंग',
      trendingText: 'चहा Tapri — सर्वात गरम मुद्दे',
      discussions: 'तुमच्या चर्चाएँ',
      profile: 'प्रोफाइल',
      profileText: 'तुमचा अकाउंट, पसंती आणि नागरिक प्रभाव व्यवस्थापित करा.',
      tabs: ['लोकल चहा', 'चहा Tapri', 'माझी चर्चा', 'प्रोफाइल'],
    },
    aiShowcase: {
      eyebrow: 'AI तुमची तक्रार समजते',
      title: 'कोणत्याही भाषेत बोला. AI सर्व समजतो.',
      supportText: 'AI ने समस्या समजली',
      duplicateEyebrow: 'एकाच तक्रारीचे दोनदा नोंदणी करू नका',
      duplicateTitle: 'अरे, हा चहा आधीपासून चालू आहे!',
      duplicateText: 'तक्रार नोंदवण्यापूर्वी CivicChai त्याच PIN मधील शब्द, परिसर आणि श्रेणी यांची तुलना करून सारख्या तक्रारी दाखवते.',
      duplicateNote: 'आम्ही तुम्हाला नाकारत नाही. तुम्ही नेहमी निवडता: विद्यमान चर्चेला पाठिंबा द्या किंवा वेगळ्या समस्येसाठी नोंदणी करा.',
      prompt: 'या चर्चेला पाठिंबा द्या',
    },
    tapriPage: {
      eyebrow: 'चहा Tapri',
      title: 'देखे कशा मुद्द्याची चहा सर्वात गरम आहे.',
      subtitle: 'मुद्दे सार्वजनिक दृश्यतेत वाढतात, ज्यामध्ये तातडी, पुनरावृत्ती, समुदायाचा पाठिंबा आणि कारवाईची तीव्रता महत्त्वाची असते — फक्त मांडलेले वोट्स नाहीत.',
      trendingLabel: 'या आठवड्यात ट्रेंडिंग',
      trendTitle: 'सुधार प्राधान्यांचे लोकल हीट मॅप',
      realTimeSignal: 'रिअल-टाइम सिग्नल',
      heat: 'हीट',
      cards: [
        { title: 'सार्वजनिक तातडी', text: 'जितके जास्त लोक समस्या जाणतात, तितकी ती अधिक दिसू लागते.' },
        { title: 'कार्रवाई योग्य गती', text: 'दोनदा दिलेल्या रिपोर्ट्स आणि पाठिंब्यामुळे अधिकाऱ्यांसाठी स्पष्टता येते.' },
        { title: 'पुढे जा', text: 'मुद्दे मजबूत केले जाऊ शकतात, सोडवले जाऊ शकतात किंवा पूर्ण संदर्भासह पुन्हा पाहिले जाऊ शकतात.' },
      ],
      cta: 'चर्चेत सहभागी व्हा',
    },
    landing: {
      whatIsCards: [
        { title: 'चर्चा, तक्रार नाही', description: 'हर मुद्दा अशी चर्चा आहे ज्यामध्ये तुमचे शेजारी सहभागी होऊ शकतात, पाठिंबा देऊ शकतात आणि त्याला आकार देऊ शकतात.' },
        { title: 'AI जे तुमचा अर्थ समजते', description: 'हिंदी, मराठी, इंग्रजी किंवा Hinglish मध्ये लिहा किंवा बोला — AI समजून घेतो.' },
        { title: 'सही ऑफिसकडे थेट', description: 'मुद्दे योग्य विभाग, अधिकारी आणि नगर हबकडे रूट होतात.' },
      ],
      howFlow: ['स्कॅन', 'रिपोर्ट', 'AI समजतो', 'डुप्लिकेट तपासणी', 'सामुदायिक मतदान', 'चहा गरम होतो', 'विभाग कृती', 'निर्णय ट्रॅक'],
      channels: [
        { title: 'स्मार्टफोन', description: 'तक्रार बोला — आवाज स्ट्रक्चर्ड तक्रार बनते.' },
        { title: 'कीपॅड फोन', description: 'फक्त CivicChai वर कॉल करा. वॉइस एजेंट तुमच्यासाठी अपलोड करतो, DTMF fallbackही समाविष्ट आहे.' },
        { title: 'वेब', description: 'तुमच्या भाषेत टाइप करा, कोणत्याही ब्राउझरमध्ये, अगदी शेअर्ड डिव्हाइसवरही.' },
      ],
      channelEyebrow: 'स्मार्टफोन शिवायही काम करते',
      channelTitle: 'हर आवाजीत अर्थ असतो.',
      channelSubtitle: 'स्मार्टफोन, कीपॅड फोन किंवा वेब — वॉइस एजेंट आणि AI प्रत्येक चॅनेलला समान नागरी समस्येमध्ये बदलतात.',
      channelFooter: 'वॉइस एजंट → AI → तक्रार, तुमच्या भाषेत.',
      finalTitle: 'हर मोहल्ल्यात एक चहा असतो. हर चहाला एक चर्चा असते. आणि हर चर्चेतून बदल सुरू होऊ शकतो.',
      finalSubtitle: 'चहा थंड होण्यापूर्वी, बोलणी पुढे वाढवा.',
      finalCta: 'तुमची चर्चा सुरू करा',
    },
  },
}
