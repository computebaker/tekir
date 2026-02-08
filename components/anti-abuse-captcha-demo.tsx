/**
 * Demo component showing how to integrate anti-abuse CAPTCHA
 * This can be used for testing or as a reference implementation
 */

'use client';

import { useEffect, useState } from 'react';
import {
  executeAntiAbuseChallengeFlow,
  getSessionIdFromUrl,
  getSeverityFromUrl,
} from '@/lib/captcha-client';
import { trackClientLog } from '@/lib/posthog-analytics';

interface DemoState {
  loading: boolean;
  passed: boolean;
  sessionId: string | null;
  severity: string | null;
  message: string;
  logs: string[];
}

export default function AntiAbuseCaptchaDemo() {
  const [state, setState] = useState<DemoState>({
    loading: true,
    passed: false,
    sessionId: null,
    severity: null,
    message: 'Verifying...',
    logs: [],
  });

  const addLog = (message: string) => {
    trackClientLog('captcha_demo_log', { message });
    setState((prev) => ({
      ...prev,
      logs: [...prev.logs, `${new Date().toLocaleTimeString()}: ${message}`],
    }));
  };

  useEffect(() => {
    const sessionId = getSessionIdFromUrl();
    const severity = getSeverityFromUrl();

    setState((prev) => ({
      ...prev,
      sessionId,
      severity,
    }));

    addLog(`Detected session ID: ${sessionId ?? 'none'}`);
    addLog(`Risk severity: ${severity ?? 'none'}`);

    // Execute anti-abuse challenge flow
    (async () => {
      try {
        addLog('Starting anti-abuse challenge flow...');
        const result = await executeAntiAbuseChallengeFlow();

        addLog(`Challenge result: ${result.passed ? 'PASSED' : 'FAILED'}`);
        addLog(`Message: ${result.message}`);

        setState((prev) => ({
          ...prev,
          loading: false,
          passed: result.passed,
          message: result.message,
          sessionId: result.sessionId,
        }));

        if (result.passed) {
          addLog('User verification successful!');
          setTimeout(() => {
            // In real implementation, proceed with page or show CAPTCHA
            addLog(
              'Ready to proceed with Ribaunt CAPTCHA or page access'
            );
          }, 1000);
        } else {
          addLog('User verification failed. Access denied.');
        }
      } catch (error) {
        addLog(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        setState((prev) => ({
          ...prev,
          loading: false,
          passed: false,
          message: 'Verification failed',
        }));
      }
    })();
  }, []);

  return (
    <div className="flex min-h-screen flex-col gap-4 bg-slate-50 p-8 dark:bg-slate-900">
      <div className="mx-auto w-full max-w-2xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
            Anti-Abuse CAPTCHA Demo
          </h1>
          <p className="mt-2 text-slate-600 dark:text-slate-400">
            Testing browser fingerprinting and challenge verification
          </p>
        </div>

        {/* Status Card */}
        <div
          className={`mb-6 rounded-lg border-2 p-6 ${
            state.loading
              ? 'border-blue-300 bg-blue-50 dark:border-blue-700 dark:bg-blue-950'
              : state.passed
                ? 'border-green-300 bg-green-50 dark:border-green-700 dark:bg-green-950'
                : 'border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-950'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`text-3xl ${
                state.loading ? '🔄' : state.passed ? '✅' : '❌'
              }`}
            />
            <div>
              <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
                {state.loading ? 'Verifying...' : state.passed ? 'Verification Passed' : 'Verification Failed'}
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {state.message}
              </p>
            </div>
          </div>
        </div>

        {/* Session Info */}
        <div className="mb-6 rounded-lg bg-white p-6 shadow-sm dark:bg-slate-800">
          <h3 className="mb-4 font-semibold text-slate-900 dark:text-white">
            Session Information
          </h3>
          <div className="space-y-2 font-mono text-sm">
            <div className="flex justify-between">
              <span className="text-slate-600 dark:text-slate-400">
                Session ID:
              </span>
              <span className="text-slate-900 dark:text-white">
                {state.sessionId ?? 'Not assigned'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600 dark:text-slate-400">
                Risk Severity:
              </span>
              <span
                className={
                  state.severity === 'high'
                    ? 'text-red-600 dark:text-red-400'
                    : state.severity === 'medium'
                      ? 'text-yellow-600 dark:text-yellow-400'
                      : 'text-green-600 dark:text-green-400'
                }
              >
                {state.severity ?? 'Not determined'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600 dark:text-slate-400">
                Status:
              </span>
              <span className="text-slate-900 dark:text-white">
                {state.loading ? 'Checking...' : state.passed ? 'Passed' : 'Failed'}
              </span>
            </div>
          </div>
        </div>

        {/* Logs */}
        <div className="rounded-lg bg-white p-6 shadow-sm dark:bg-slate-800">
          <h3 className="mb-4 font-semibold text-slate-900 dark:text-white">
            Verification Logs
          </h3>
          <div className="space-y-1 font-mono text-xs">
            {state.logs.length === 0 ? (
              <div className="text-slate-400 dark:text-slate-600">
                No logs yet...
              </div>
            ) : (
              state.logs.map((log, idx) => (
                <div
                  key={idx}
                  className="text-slate-600 dark:text-slate-400"
                >
                  {log}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Info Box */}
        <div className="mt-8 rounded-lg bg-blue-50 p-6 dark:bg-blue-950">
          <h3 className="mb-2 font-semibold text-blue-900 dark:text-blue-100">
            ℹ️ How This Works
          </h3>
          <ul className="space-y-2 text-sm text-blue-800 dark:text-blue-200">
            <li>
              ✓ Analyzes your User Agent and browser headers
            </li>
            <li>
              ✓ Assigns a risk score based on suspicious patterns
            </li>
            <li>
              ✓ If risky, generates a challenge session
            </li>
            <li>
              ✓ Requires you to load specific JS/CSS resources
            </li>
            <li>
              ✓ Verifies resources actually loaded (not a headless bot)
            </li>
            <li>
              ✓ If you pass, you can proceed to solve the CAPTCHA
            </li>
          </ul>
        </div>

        {/* Next Steps */}
        {!state.loading && (
          <div className="mt-8">
            {state.passed ? (
              <button
                onClick={() => {
                  // In real implementation, show CAPTCHA or proceed
                  alert(
                    'Anti-abuse verification passed! Ready for Ribaunt CAPTCHA.'
                  );
                }}
                className="w-full rounded-lg bg-green-600 px-4 py-3 font-semibold text-white hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600"
              >
                Proceed to CAPTCHA Challenge
              </button>
            ) : (
              <button
                onClick={() => {
                  window.location.reload();
                }}
                className="w-full rounded-lg bg-red-600 px-4 py-3 font-semibold text-white hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-600"
              >
                Try Again
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
