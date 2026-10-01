import {
  CormorantGaramond_400Regular,
  CormorantGaramond_600SemiBold,
} from '@expo-google-fonts/cormorant-garamond';
import { Inter_400Regular, Inter_500Medium } from '@expo-google-fonts/inter';
import { NotoSerifEthiopic_400Regular } from '@expo-google-fonts/noto-serif-ethiopic';
import { useFonts } from 'expo-font';
import { Tabs } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CrossIcon } from '@/components/CrossIcon';
import '@/i18n';
import { colors, fonts, spacing } from '@/theme';

SplashScreen.preventAutoHideAsync();

function HeaderTitle() {
  const { t } = useTranslation();
  return (
    <View style={styles.titleRow}>
      <CrossIcon size={26} />
      <View>
        <Text style={styles.title}>{t('app.name')}</Text>
        <Text style={styles.tagline}>{t('app.tagline')}</Text>
      </View>
    </View>
  );
}

function LanguageToggle() {
  const { t, i18n } = useTranslation();
  const next = i18n.language === 'am' ? 'en' : 'am';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('language.label')}
      onPress={() => i18n.changeLanguage(next)}
      style={styles.langBtn}>
      <Text style={styles.langText}>{t('language.switchTo')}</Text>
    </Pressable>
  );
}

export default function RootLayout() {
  const { t } = useTranslation();
  const [loaded] = useFonts({
    CormorantGaramond_400Regular,
    CormorantGaramond_600SemiBold,
    Inter_400Regular,
    Inter_500Medium,
    NotoSerifEthiopic_400Regular,
  });

  useEffect(() => {
    if (loaded) SplashScreen.hideAsync();
  }, [loaded]);

  if (!loaded) return null;

  return (
    <>
      <StatusBar style="light" />
      <Tabs
        initialRouteName="study"
        screenOptions={{
          headerTitle: () => <HeaderTitle />,
          headerRight: () => <LanguageToggle />,
          headerStyle: { backgroundColor: colors.ink },
          headerShadowVisible: false,
          tabBarStyle: { backgroundColor: colors.ink, borderTopColor: colors.goldFaint },
          tabBarActiveTintColor: colors.gold,
          tabBarInactiveTintColor: colors.parchmentDim,
          tabBarLabelStyle: { fontFamily: fonts.uiMedium, fontSize: 11, letterSpacing: 0.8 },
          tabBarIconStyle: { display: 'none' },
        }}>
        <Tabs.Screen name="index" options={{ href: null }} />
        <Tabs.Screen name="study" options={{ title: t('modes.study') }} />
        <Tabs.Screen name="devotion" options={{ title: t('modes.devotion') }} />
        <Tabs.Screen name="open" options={{ title: t('modes.open') }} />
      </Tabs>
    </>
  );
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm + 6 },
  title: { fontFamily: fonts.display, fontSize: 24, color: colors.gold, letterSpacing: 1 },
  tagline: {
    fontFamily: fonts.ui,
    fontSize: 10,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: colors.parchmentDim,
  },
  langBtn: {
    marginRight: spacing.md,
    borderWidth: 1,
    borderColor: colors.goldBorder,
    borderRadius: 2,
    paddingVertical: 5,
    paddingHorizontal: 12,
  },
  langText: { fontFamily: fonts.ethiopic, fontSize: 13, color: colors.gold },
});
