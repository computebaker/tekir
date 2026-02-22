/**
 * Environment variable validation utilities
 * Validates all required environment variables at startup
 */

interface EnvVarConfig {
  name: string;
  required: boolean;
  description: string;
  validator?: (value: string) => boolean;
}

/**
 * Environment variable configuration
 */
const ENV_VARS: EnvVarConfig[] = [
  {
    name: 'JWT_SECRET',
    required: true,
    description: 'Secret key for JWT token signing and verification',
    validator: (value) => value.length >= 32, // At least 32 characters
  },
  {
    name: 'CONVEX_CRON_SECRET',
    required: true,
    description: 'Secret key for cron job authentication',
    validator: (value) => value.length >= 16,
  },
  {
    name: 'CONVEX_DEPLOYMENT',
    required: true,
    description: 'Convex deployment URL',
  },
  {
    name: 'NEXT_PUBLIC_CONVEX_DEPLOYMENT',
    required: true,
    description: 'Public Convex deployment URL',
  },
  {
    name: 'NEXT_PUBLIC_APP_URL',
    required: false,
    description: 'Public application URL',
  },
];

/**
 * Validation errors
 */
interface ValidationError {
  name: string;
  message: string;
}

/**
 * Validate all environment variables
 * Throws an error if any required variables are missing or invalid
 */
export function validateEnv(): void {
  const errors: ValidationError[] = [];
  const warnings: string[] = [];

  for (const config of ENV_VARS) {
    const value = process.env[config.name];

    if (!value) {
      if (config.required) {
        errors.push({
          name: config.name,
          message: `Missing required environment variable: ${config.name}`,
        });
      }
      continue;
    }

    // Run custom validator if provided
    if (config.validator && !config.validator(value)) {
      errors.push({
        name: config.name,
        message: `Invalid value for ${config.name}: ${config.description}`,
      });
    }

    // Security warnings for weak secrets
    if (config.name.includes('SECRET') || config.name.includes('KEY')) {
      if (value.length < 32) {
        warnings.push(
          `⚠️  Warning: ${config.name} is less than 32 characters. ` +
          `Consider using a stronger secret.`
        );
      }

      // Check for common weak secrets
      const weakSecrets = ['secret', 'password', '123456', 'changeme', 'test'];
      if (weakSecrets.some(weak => value.toLowerCase().includes(weak))) {
        warnings.push(
          `⚠️  Warning: ${config.name} appears to be a weak secret. ` +
          `Please use a strong, randomly generated secret.`
        );
      }
    }
  }

  // Log warnings
  if (warnings.length > 0 && process.env.NODE_ENV !== 'test') {
    console.warn('\n=== Environment Variable Security Warnings ===');
    warnings.forEach(warning => console.warn(warning));
    console.warn('=== End Warnings ===\n');
  }

  // Throw if there are errors
  if (errors.length > 0) {
    const errorMessage = [
      '\n=== Environment Variable Validation Failed ===',
      'The following environment variables are missing or invalid:',
      ...errors.map(e => `  - ${e.message}`),
      '\nPlease set these environment variables before starting the application.',
      '=== End Validation Errors ===\n',
    ].join('\n');

    throw new Error(errorMessage);
  }
}

/**
 * Get environment variable with type safety
 * Throws if required variable is missing
 */
export function getEnvVar(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

/**
 * Get optional environment variable with fallback
 */
export function getOptionalEnvVar(name: string, fallback: string = ''): string {
  return process.env[name] || fallback;
}

/**
 * Check if running in production
 */
export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

/**
 * Check if running in development
 */
export function isDevelopment(): boolean {
  return process.env.NODE_ENV === 'development';
}

/**
 * Check if running in test
 */
export function isTest(): boolean {
  return process.env.NODE_ENV === 'test';
}

/**
 * Validate environment at module load time
 * This will throw immediately if the environment is invalid
 */
if (process.env.NODE_ENV !== 'test' && process.env.NODE_ENV !== 'development' && process.env.NEXT_PHASE !== 'phase-production-build') {
  try {
    validateEnv();
  } catch (error) {
    // Re-throw with better error message
    if (error instanceof Error) {
      console.error('FATAL: Environment validation failed:');
      console.error(error.message);
      throw error;
    }
  }
}
