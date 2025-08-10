import { createHash } from 'crypto';

// Simple client-safe data URL validation
function isValidDataUrl(url: string): boolean {
  try {
    const regex = /^data:image\/(jpeg|jpg|png);base64,/;
    return regex.test(url);
  } catch {
    return false;
  }
}

// Available avatar styles from DiceBear API
const AVATAR_STYLES = [
  'identicon'
];

/**
 * Gets the appropriate avatar URL for a user
 * Prioritizes custom uploaded images, then falls back to generated avatars
 * Adds cache-busting parameter to prevent stale images
 */
export function getUserAvatarUrl(user: {
  id?: string;
  image?: string | null;
  imageType?: string | null;
  email?: string | null;
  name?: string | null;
  updatedAt?: string | Date | null;
}, size: number = 150): string {
  // If user has a custom uploaded image, use it with cache busting
  if (user.image && user.imageType === 'uploaded' && isValidDataUrl(user.image)) {
    // For data URLs, add a cache-busting fragment
    const cacheBuster = user.updatedAt ? new Date(user.updatedAt).getTime() : Date.now();
    return `${user.image}#t=${cacheBuster}`;
  }
  
  // If user has a generated avatar, use the stored URL with cache busting
  if (user.image && user.imageType === 'generated' && user.image.startsWith('http')) {
    const separator = user.image.includes('?') ? '&' : '?';
    const cacheBuster = user.updatedAt ? new Date(user.updatedAt).getTime() : Date.now();
    return `${user.image}${separator}_t=${cacheBuster}`;
  }
  
  // If user has imageType 'generated' but no stored URL, generate consistent avatar
  if (user.imageType === 'generated' && user.id) {
    const avatarUrl = generateAvatarUrl(user.id, user.email || undefined, size);
    const cacheBuster = user.updatedAt ? new Date(user.updatedAt).getTime() : Date.now();
    return `${avatarUrl}&_t=${cacheBuster}`;
  }
  
  // If user has a valid external image URL, use it with cache busting
  if (user.image && !user.imageType && user.image.startsWith('http')) {
    const separator = user.image.includes('?') ? '&' : '?';
    const cacheBuster = user.updatedAt ? new Date(user.updatedAt).getTime() : Date.now();
    return `${user.image}${separator}_t=${cacheBuster}`;
  }
  
  // Fall back to generated avatar with cache busting
  if (user.id) {
    const avatarUrl = generateAvatarUrl(user.id, user.email || undefined, size);
    const cacheBuster = user.updatedAt ? new Date(user.updatedAt).getTime() : Date.now();
    return `${avatarUrl}&_t=${cacheBuster}`;
  }
  
  // Final fallback to initials avatar
  return generateInitialsAvatar(user.name || user.email || "User", size);
}

// Generate a deterministic but random-looking seed based on user data
function generateSeed(userId: string, email?: string): string {
  const input = `${userId}-${email || 'default'}`;
  return createHash('md5').update(input).digest('hex').substring(0, 16);
}

// Generate a random avatar style
function getRandomStyle(seed: string): string {
  const hash = createHash('md5').update(seed).digest('hex');
  const index = parseInt(hash.substring(0, 8), 16) % AVATAR_STYLES.length;
  return AVATAR_STYLES[index];
}

// Generate random background colors
function getRandomColors(seed: string): { backgroundColor: string; } {
  const hash = createHash('md5').update(`${seed}-colors`).digest('hex');
  const colors = [
    'b6e3f4', 'c0aede', 'd1d4f9', 'ffd5dc', 'ffdfba', 
    'c7ceea', 'ffc8a2', 'd4edda', 'f8d7da', 'fff3cd',
    'e2e3e5', 'bee5eb', 'fadbd8', 'ebdef0', 'd5f4e6'
  ];
  const index = parseInt(hash.substring(0, 8), 16) % colors.length;
  return { backgroundColor: colors[index] };
}

// Generate avatar URL using DiceBear API
export function generateAvatarUrl(userId: string, email?: string, size: number = 150): string {
  const seed = generateSeed(userId, email);
  const style = getRandomStyle(seed);
  const { backgroundColor } = getRandomColors(seed);
  
  // DiceBear API v7 URL format
  const params = new URLSearchParams({
    size: size.toString(),
    backgroundColor: backgroundColor,
    radius: '50', // Make it circular
    scale: '80'
  });
  
  return `https://api.dicebear.com/7.x/${style}/svg?seed=${seed}&${params.toString()}`;
}

// Fallback: Generate initials-based avatar
export function generateInitialsAvatar(name: string, size: number = 150): string {
  const initials = name
    .split(' ')
    .map(word => word.charAt(0).toUpperCase())
    .join('')
    .substring(0, 2);
  
  // Generate a color based on the name
  const hash = createHash('md5').update(name).digest('hex');
  const hue = parseInt(hash.substring(0, 2), 16) % 360;
  
  // Create SVG for initials avatar
  const svg = `
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
      <circle cx="${size/2}" cy="${size/2}" r="${size/2}" fill="hsl(${hue}, 65%, 55%)"/>
      <text x="${size/2}" y="${size/2 + 8}" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="${size/3}" font-weight="600">
        ${initials}
      </text>
    </svg>
  `;
  
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

// Update user avatar (for future use if needed)
export function regenerateAvatar(userId: string, email?: string): string {
  // Force regeneration by adding timestamp to seed
  const timestampSeed = `${userId}-${email || 'default'}-${Date.now()}-regen`;
  const seed = createHash('md5').update(timestampSeed).digest('hex').substring(0, 16);
  const style = getRandomStyle(seed);
  const { backgroundColor } = getRandomColors(seed);
  
  const params = new URLSearchParams({
    size: '150',
    backgroundColor: backgroundColor,
    radius: '50',
    scale: '80'
  });
  
  return `https://api.dicebear.com/7.x/${style}/svg?seed=${seed}&${params.toString()}`;
}

export const avatarUtils = {
  generateAvatarUrl,
  generateInitialsAvatar,
  regenerateAvatar,
  getUserAvatarUrl,
};

export default avatarUtils;
