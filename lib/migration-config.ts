// Migration configuration - controls which endpoints to use
// Set useConvex to true to start using Convex endpoints

export const migrationConfig = {
  // Set to true to use Convex endpoints, false to use original Prisma endpoints
  useConvex: true,
  
  // Individual feature flags for gradual migration
  features: {
    auth: {
      signup: true,
      signin: true, // Note: signin still uses NextAuth but with Convex backend
      verifyEmail: true,
      sendVerification: true,
      getUserEmail: true,
    },
    user: {
      updateName: true,
      updateEmail: true,
      updateUsername: true,
      updatePassword: true,
      deleteAccount: true,
      avatarUpload: true,
      avatarRegenerate: true,
    },
    settings: {
      // Settings now use Convex real-time sync - no more API endpoints needed
    },
    session: {
      register: true,
      link: true,
    },
    search: {
      pars: true,
    }
  }
};

// Helper function to get the correct API endpoint
export function getApiEndpoint(category: keyof typeof migrationConfig.features, action: string, fallback: string): string {
  const categoryConfig = migrationConfig.features[category] as any;
  const useConvexForFeature = migrationConfig.useConvex && categoryConfig && categoryConfig[action];
  
  if (useConvexForFeature) {
    return fallback;
  }
  
  return fallback;
}

// API endpoint mapping
export const apiEndpoints = {
  auth: {
    signup: () => getApiEndpoint('auth', 'signup', '/api/auth/signup'),
    verifyEmail: () => getApiEndpoint('auth', 'verifyEmail', '/api/auth/verify-email'),
    sendVerification: () => getApiEndpoint('auth', 'sendVerification', '/api/auth/send-verification'),
    getUserEmail: () => getApiEndpoint('auth', 'getUserEmail', '/api/auth/get-user-email'),
  },
  user: {
    updateName: () => getApiEndpoint('user', 'updateName', '/api/user/name'),
    updateEmail: () => getApiEndpoint('user', 'updateEmail', '/api/user/email'),
    updateUsername: () => getApiEndpoint('user', 'updateUsername', '/api/user/username'),
    updatePassword: () => getApiEndpoint('user', 'updatePassword', '/api/user/password'),
    deleteAccount: () => getApiEndpoint('user', 'deleteAccount', '/api/user/delete'),
    avatarUpload: () => getApiEndpoint('user', 'avatarUpload', '/api/user/avatar/upload'),
    avatarRegenerate: () => getApiEndpoint('user', 'avatarRegenerate', '/api/user/avatar/regenerate'),
  },
  settings: {
    // Deleted, please use Convex real-time sync
  },
  session: {
    register: () => getApiEndpoint('session', 'register', '/api/session/register'),
    link: () => getApiEndpoint('session', 'link', '/api/session/link'),
  },
  search: {
    pars: (provider: string) => {
      const base = getApiEndpoint('search', 'pars', `/api/pars/${provider}`);
      return base;
    }
  }
};
