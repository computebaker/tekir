import { createHash } from 'crypto';

// Available avatar styles from DiceBear API
const AVATAR_STYLES = [
  'identicon'
];

// Generate a deterministic but random-looking seed based on user data
function generateSeed(userId: string, email?: string): string {
  const input = `${userId}-${email || 'default'}-${Date.now()}`;
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

export default { generateAvatarUrl, generateInitialsAvatar, regenerateAvatar };
