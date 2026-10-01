export const colors = {
  gold: '#C9A84C',
  deepRed: '#7B1F1F',
  parchment: '#F5EDD8',
  ink: '#1A1108',
  ash: '#3D2B1F',
  mist: '#EDE4CC',
  accent: '#8B3A3A',
  // translucent helpers used across screens
  goldFaint: 'rgba(201,168,76,0.2)',
  goldBorder: 'rgba(201,168,76,0.3)',
  goldWash: 'rgba(201,168,76,0.12)',
  parchmentDim: 'rgba(245,237,216,0.55)',
  parchmentWash: 'rgba(245,237,216,0.05)',
} as const;

export const fonts = {
  display: 'CormorantGaramond_600SemiBold',
  scripture: 'CormorantGaramond_400Regular',
  ui: 'Inter_400Regular',
  uiMedium: 'Inter_500Medium',
  ethiopic: 'NotoSerifEthiopic_400Regular',
} as const;

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;
