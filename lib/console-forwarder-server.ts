import { trackServerLog } from '@/lib/analytics-server';

const FORWARDER_KEY = '__tekirConsoleForwardingServerInitialized';
const MAX_MESSAGE_LENGTH = 1000;

const toSafeString = (value: unknown): string => {
  if (typeof value === 'string') return value;
  if (value instanceof Error) return `${value.name}: ${value.message}`;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

const buildMessage = (args: unknown[]): string => {
  const message = args.map(toSafeString).join(' ');
  return message.length > MAX_MESSAGE_LENGTH
    ? `${message.slice(0, MAX_MESSAGE_LENGTH)}…`
    : message;
};

export function initServerConsoleForwarding(): void {
  const globalScope = globalThis as typeof globalThis & {
    [FORWARDER_KEY]?: boolean;
  };

  if (globalScope[FORWARDER_KEY]) return;
  globalScope[FORWARDER_KEY] = true;

  const original = {
    log: console.log.bind(console),
    info: console.info.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console),
  };

  let isForwarding = false;

  const forward = (level: 'log' | 'info' | 'warn' | 'error', args: unknown[]) => {
    if (isForwarding) return;

    const message = buildMessage(args);
    if (!message || message.includes('[PostHog]')) return;

    const errorArg = args.find((arg) => arg instanceof Error) as Error | undefined;

    isForwarding = true;
    try {
      trackServerLog(message, {
        level,
        source: 'console',
        arg_count: args.length,
        has_error: Boolean(errorArg),
        error_name: errorArg?.name,
        error_message: errorArg?.message,
      });
    } finally {
      isForwarding = false;
    }
  };

  console.log = (...args: unknown[]) => {
    original.log(...args);
    forward('log', args);
  };

  console.info = (...args: unknown[]) => {
    original.info(...args);
    forward('info', args);
  };

  console.warn = (...args: unknown[]) => {
    original.warn(...args);
    forward('warn', args);
  };

  console.error = (...args: unknown[]) => {
    original.error(...args);
    forward('error', args);
  };
}
