import type en from './en';

// Amharic strings. Must match the shape of en.ts.
// TODO: have a native Amharic speaker review these before release.
const am: typeof en = {
  app: {
    name: 'ትምህርት',
    tagline: 'የቅዱስ መጽሐፍ ጥናት · ኦርቶዶክስ ተዋሕዶ',
    meaning: 'ትምህርት ማለት "teaching" ማለት ነው',
  },
  modes: {
    study: 'ጥናት',
    devotion: 'ጸሎት',
    open: 'ውይይት',
    read: 'ንባብ',
    account: 'መለያ',
  },
  account: {
    title: 'መለያ',
    intro: 'ማስታወሻዎችዎ እና ምልክቶችዎ በሁሉም መሣሪያዎችዎ ላይ እንዲመሳሰሉ ይግቡ። የአንድ ጊዜ አገናኝ በኢሜይል እንልክልዎታለን። የይለፍ ቃል አያስፈልግም።',
    emailPlaceholder: 'you@example.com',
    sendLink: 'የመግቢያ አገናኝ በኢሜይል ላክልኝ',
    sending: 'በመላክ ላይ...',
    checkEmail: 'ኢሜይልዎን ይመልከቱ፣ አገናኙንም በዚህ መሣሪያ ላይ ይክፈቱ።',
    signedInAs: 'የገቡት በ',
    signOut: 'ውጣ',
    syncReady: 'የግል ቦታዎ ዝግጁ ነው።',
    profileProblem: 'ገብተዋል፣ ግን መገለጫዎን ማንበብ አልተቻለም።',
    notConfigured: 'ማመሳሰል በዚህ ስሪት ላይ አልተዋቀረም። መተግበሪያው ያለ በይነመረብ በሙሉ ይሠራል።',
  },
  sync: {
    syncing: 'በማመሳሰል ላይ...',
    ok: 'ወቅታዊ ነው',
    lastSynced: 'መጨረሻ የተመሳሰለው {{time}}',
    offline: 'ከመስመር ውጭ ወይም መድረስ አልተቻለም። ለውጦችዎ እዚህ ተቀምጠዋል፣ ግንኙነት ሲመለስ ይመሳሰላሉ።',
    otherAccount: 'ይህ መሣሪያ ከሌላ መለያ የተገኘ መረጃ ስላለው፣ የሁለቱም መለያዎች ግላዊነት እንዲጠበቅ ማመሳሰል ቆሟል።',
    waiting_one: '{{count}} ለውጥ ለመጫን በመጠበቅ ላይ',
    waiting_other: '{{count}} ለውጦች ለመጫን በመጠበቅ ላይ',
    syncNow: 'አሁን አመሳስል',
  },
  reader: {
    title: 'መጽሐፍ ቅዱስ',
    oldTestament: 'ብሉይ ኪዳን',
    newTestament: 'አዲስ ኪዳን',
    chapter: 'ምዕራፍ',
    bookmark: 'ይህን ቁጥር ዕልባት አድርግ',
    noData: 'የመጽሐፍ ቅዱስ ጽሑፍ በዚህ መሣሪያ ላይ አልተጫነም።',
    notAvailable: 'ጽሑፉ በዚህ ቋንቋ ገና አልተገኘም።',
    amharicNote: 'የአማርኛው ጽሑፍ ከምስል በማንበብ የተገኘ ስለሆነ ገና አልተረጋገጠም። አንዳንድ ቁጥሮች ሊጣመሩ ወይም ስህተት ሊኖራቸው ይችላል።',
    chapters: '{{count}} ምዕራፎች',
    english: 'English',
    amharic: 'አማርኛ',
  },
  screens: {
    study: {
      title: 'ጥናት',
      intro: 'ምንባብ ወይም ርዕስ ምረጥና ቁጥር በቁጥር አብረን እንማር።',
    },
    devotion: {
      title: 'ጸሎት',
      intro: 'ለዛሬ አጭር ቃል፣ ማሰላሰል እና ጸሎት።',
    },
    open: {
      title: 'ውይይት',
      intro: 'ስለ እምነት፣ ጥርጣሬ ወይም ሕይወት ማንኛውንም ጥያቄ አምጣ።',
    },
  },
  status: {
    comingSoon: 'በኋላ ምዕራፍ ይመጣል',
  },
  language: {
    switchTo: 'EN',
    label: 'ቋንቋ',
  },
};

export default am;
