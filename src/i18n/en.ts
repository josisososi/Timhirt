export default {
  app: {
    name: 'Timhirt',
    tagline: 'Scripture Study · Ethiopian Orthodox',
    meaning: 'Timhirt means "teaching" in Amharic',
  },
  modes: {
    study: 'Study',
    devotion: 'Devotion',
    open: 'Open',
    read: 'Read',
  },
  reader: {
    title: 'Scripture',
    oldTestament: 'Old Testament',
    newTestament: 'New Testament',
    chapter: 'Chapter',
    noData: 'The scripture text is not installed on this device. Run scripts/export_scripture.py to add it.',
    notAvailable: 'Text not yet available in this language.',
    amharicNote: 'Amharic text is read from a scan by OCR and is unverified. Some verses may be joined or contain errors.',
    chapters: '{{count}} chapters',
    english: 'English',
    amharic: 'አማርኛ',
  },
  screens: {
    study: {
      title: 'Study',
      intro: 'Choose a passage or theme and study it together, verse by verse.',
    },
    devotion: {
      title: 'Devotion',
      intro: 'A short Scripture, a reflection, and a prayer for today.',
    },
    open: {
      title: 'Open',
      intro: 'Bring any question about faith, doubt, or life.',
    },
  },
  status: {
    comingSoon: 'Coming in a later phase',
  },
  language: {
    switchTo: 'አማ',
    label: 'Language',
  },
};
