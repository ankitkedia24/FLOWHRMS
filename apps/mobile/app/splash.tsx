import React from 'react';
import { useRouter } from 'expo-router';
import { SplashScreenView } from '@/components/ui/SplashScreenView';

export default function SplashScreen() {
  const router = useRouter();

  return (
    <SplashScreenView
      onLoaded={() => {
        router.replace('/(tabs)');
      }}
    />
  );
}
