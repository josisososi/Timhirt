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
  },
  reader: {
    title: 'መጽሐፍ ቅዱስ',
    oldTestament: 'ብሉይ ኪዳን',
    newTestament: 'አዲስ ኪዳን',
    chapter: 'ምዕራፍ',
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
