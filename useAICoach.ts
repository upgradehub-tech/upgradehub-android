import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import { AICoachMode, ApprovedUserContext, AICoachResponse } from '@/types/study-coach';

export type CoachState = 'idle' | 'loading' | 'retrying' | 'success' | 'error' | 'timeout';

interface UseAICoachReturn {
  state: CoachState;
  response: AICoachResponse | null;
  errorMessage: string | null;
  submitQuery: (mode: AICoachMode, userPrompt: string, context: ApprovedUserContext) => Promise<void>;
  resetCoach: () => void;
}

export function useAICoach(): UseAICoachReturn {
  const [state, setState] = useState<CoachState>('idle');
  const [response, setResponse] = useState<AICoachResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const resetCoach = useCallback(() => {
    setState('idle');
    setResponse(null);
    setErrorMessage(null);
  }, []);

  const submitQuery = useCallback(async (mode: AICoachMode, userPrompt: string, context: ApprovedUserContext) => {
    setState('loading');
    setErrorMessage(null);

    // Server verify karta hai ki request logged-in user ki hai
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) {
      setState('error');
      setErrorMessage('Please sign in to use the AI Coach.');
      return;
    }

    const executeCall = async (retryCount = 0): Promise<void> => {
      try {
        const res = await fetch('/api/ai/coach', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ mode, userPrompt, context }),
        });

        let data: any = null;
        try {
          data = await res.json();
        } catch {
          data = null;
        }

        if (!res.ok) {
          if (data?.code === 'TIMEOUT') {
            setState('timeout');
            setErrorMessage(data.error);
            return;
          }

          // Sirf server-side (5xx) galtiyon par retry; 400/401/429 par retry se kuch nahi badlega
          if (res.status >= 500 && retryCount < 1) {
            setState('retrying');
            await new Promise((r) => setTimeout(r, 1500));
            return executeCall(retryCount + 1);
          }

          setState('error');
          setErrorMessage(data?.error || 'Failed to communicate with AI Coach');
          return;
        }

        setResponse(data as AICoachResponse);
        setState('success');
      } catch (err: any) {
        if (retryCount < 1) {
          setState('retrying');
          await new Promise((r) => setTimeout(r, 1500));
          return executeCall(retryCount + 1);
        }
        setState('error');
        setErrorMessage(err?.message || 'Network error encountered.');
      }
    };

    await executeCall();
  }, []);

  return { state, response, errorMessage, submitQuery, resetCoach };
}
