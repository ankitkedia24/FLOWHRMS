import React from 'react';
import { useRouter } from 'expo-router';
import { ConsentModal } from '@/components/ui/ConsentModal';

export default function ConsentScreen() {
  const router = useRouter();

  return (
    <ConsentModal
      visible={true}
      userName="Rishabh"
      onAgree={() => router.back()}
      onDecline={() => router.back()}
      onClose={() => router.back()}
    />
  );
}
