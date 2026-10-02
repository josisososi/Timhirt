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
    account: 'Account',
  },
  account: {
    title: 'Account',
    intro: 'Sign in to keep your notes and highlights in sync across your devices. We will email you a one-time link. No password needed.',
    emailPlaceholder: 'you@example.com',
    sendLink: 'Email me a sign-in link',
    sending: 'Sending...',
    checkEmail: 'Check your email and open the link on this device.',
    signedInAs: 'Signed in as',
    signOut: 'Sign out',
    syncReady: 'Your private space is ready.',
    profileProblem: 'Signed in, but your profile could not be read.',
    notConfigured: 'Sync is not set up on this build. The app works fully offline.',
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
