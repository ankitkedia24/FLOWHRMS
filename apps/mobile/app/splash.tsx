import React, { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { SplashScreenView } from '@/components/ui/SplashScreenView';
import { useAuth } from '@/lib/auth-context';

/**
 * 1. Splash Screen
 * Role in Screen Hierarchy:
 * - App initialization
 * - Token & session check / restoration
 * - Architectural Rule: Splash does NOT decide whether someone is an admin or employee by itself.
 *   It restores the authentication session, gets the user's role from the session/profile,
 *   and smoothly routes them to:
 *   - /login (if unauthenticated)
 *   - Admin Dashboard / (tabs) (if Admin/Owner)
 *   - Employee Home / (tabs) (if Employee)
 */
export default function SplashScreen() {
  const router = useRouter();
  const { checkAuthSession, user } = useAuth();
  const [statusMsg, setStatusMsg] = useState('Initializing FlowHRMS...');

  const handleResolveSession = async () => {
    try {
      setStatusMsg('Checking authentication session...');
      const { isAuthenticated, role } = await checkAuthSession();

      if (!isAuthenticated) {
        setStatusMsg('No active session found. Redirecting to Login...');
        setTimeout(() => {
          router.replace('/login');
        }, 300);
      } else {
        const isAdmin = role === 'Owner' || role === 'Admin';
        setStatusMsg(
          isAdmin
            ? 'Authenticated as Admin. Opening Admin Dashboard...'
            : 'Authenticated as Employee. Opening Employee Home...'
        );
        setTimeout(() => {
          router.replace('/(tabs)');
        }, 300);
      }
    } catch {
      // Fallback to login screen on check failure
      router.replace('/login');
    }
  };

  return (
    <SplashScreenView
      statusMessage={statusMsg}
      onLoaded={handleResolveSession}
    />
  );
}
