import { useEffect, useState, useRef } from 'react';
import { useAuthStore } from '../../store/useAuthStore';
import { supabase } from '../../api/supabase';
import i18next from 'i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface BootstrapStatus {
  isReady: boolean;
  hasSession: boolean;
  error: Error | null;
}

/**
 * Deep Module: Auth & Bootstrap Service
 * Orchestrates the complex startup sequence of the application.
 */
export const useAppBootstrap = (): BootstrapStatus => {
  const { initialized, setSession, forceInitialize } = useAuthStore();
  const [error, setError] = useState<Error | null>(null);
  const isInitializedRef = useRef(false);

  useEffect(() => {
    if (isInitializedRef.current) return;
    isInitializedRef.current = true;

    let isMounted = true;

    async function bootstrap() {
      try {
        // 1. Recover Session
        const { data: { session } } = await supabase.auth.getSession();
        
        if (isMounted) {
          if (session) {
            // setSession already calls fetchProfile internally
            await setSession(session);
          }
        }

        // 2. Initialize i18n
        const savedLang = await AsyncStorage.getItem('user-language');
        if (i18next.isInitialized) {
          await i18next.changeLanguage(savedLang || 'vi');
        }

        // 3. Finalize
        if (isMounted) forceInitialize();

      } catch (err) {
        console.error('[Bootstrap] Error during initialization:', err);
        if (isMounted) {
          setError(err instanceof Error ? err : new Error('Unknown bootstrap error'));
          // Still force initialize to prevent infinite hang, even on error
          forceInitialize();
        }
      }
    }

    bootstrap();

    // 4. Listen for Auth Changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (isMounted) {
        await setSession(session);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return {
    isReady: initialized,
    hasSession: !!useAuthStore.getState().session,
    error
  };
};
