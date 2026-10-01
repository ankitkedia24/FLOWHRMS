import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  SafeAreaView,
  Dimensions,
} from 'react-native';
import { FlowHRMSLogo } from '@/components/brand/FlowHRMSLogo';

interface SplashScreenViewProps {
  onLoaded?: () => void;
}

/**
 * Mobile Splash Screen View
 * Exact implementation of Stitch "FlowHRMS - Splash Screen".
 * Atmospheric deep indigo gradient, elevated glass logo pill, tagline, and progress shimmer.
 */
export function SplashScreenView({ onLoaded }: SplashScreenViewProps) {
  return (
    <SafeAreaView style={styles.container}>
      {/* Soft background ambient ambient lights */}
      <View style={styles.radialGlowTop} />
      <View style={styles.radialGlowBottom} />

      {/* Centerpiece Content */}
      <View style={styles.centerpiece}>
        {/* Brand Logo Container with soft elevated glass pill */}
        <View style={styles.logoPill}>
          <FlowHRMSLogo width={220} height={55} variant="dark" />
        </View>

        {/* Tagline */}
        <Text style={styles.tagline}>ALIGN. ACCELERATE. GROW.</Text>

        {/* Value Proposition Badge */}
        <View style={styles.valueBadge}>
          <View style={styles.greenPulseDot} />
          <Text style={styles.valueText}>
            Phone-first HRMS for field & desk teams
          </Text>
        </View>
      </View>

      {/* Footer & Loader */}
      <View style={styles.footer}>
        {/* Loading bar */}
        <View style={styles.loaderBarContainer}>
          <View style={styles.loaderProgress} />
        </View>

        {/* Trust Credential Text */}
        <Text style={styles.credentialText}>
          Made for Indian SMEs <Text style={styles.bullet}>•</Text> Phone-first
        </Text>
        <Text style={styles.subCredentialText}>
          Respectful by design <Text style={styles.bulletDim}>•</Text> Secure & Private
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1E1B4B',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 24,
  },
  radialGlowTop: {
    position: 'absolute',
    top: '25%',
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(99, 102, 241, 0.22)',
  },
  radialGlowBottom: {
    position: 'absolute',
    bottom: 40,
    width: 220,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(129, 140, 248, 0.12)',
  },
  centerpiece: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  logoPill: {
    paddingVertical: 18,
    paddingHorizontal: 24,
    borderRadius: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    marginBottom: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 6,
  },
  tagline: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 3,
    textTransform: 'uppercase',
    color: '#C7D2FE',
    marginBottom: 16,
  },
  valueBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  greenPulseDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#34D399',
  },
  valueText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#E0E7FF',
  },
  footer: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 16,
    gap: 8,
  },
  loaderBarContainer: {
    width: 140,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    overflow: 'hidden',
    marginBottom: 8,
  },
  loaderProgress: {
    width: 70,
    height: '100%',
    borderRadius: 2,
    backgroundColor: '#818CF8',
  },
  credentialText: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.8)',
  },
  bullet: {
    color: '#818CF8',
    marginHorizontal: 4,
  },
  subCredentialText: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.5)',
  },
  bulletDim: {
    color: 'rgba(129, 140, 248, 0.5)',
    marginHorizontal: 4,
  },
});

export default SplashScreenView;
