/**
 * Username utility functions for TeamUp
 * Rules:
 * - Only letters, numbers, '.', '_', '-' allowed
 * - '.' cannot be at start or end, only in between
 * - Must be unique
 */

// Validate username format
export const isValidUsername = (username: string): boolean => {
  if (!username || username.length < 3 || username.length > 30) {
    return false;
  }
  
  // Check for invalid start/end with dot
  if (username.startsWith('.') || username.endsWith('.')) {
    return false;
  }
  
  // Only allow letters, numbers, '.', '_', '-'
  const validPattern = /^[a-zA-Z0-9._-]+$/;
  if (!validPattern.test(username)) {
    return false;
  }
  
  // No consecutive dots
  if (username.includes('..')) {
    return false;
  }
  
  return true;
};

// Generate a username from full name
export const generateUsernameFromName = (fullName: string): string => {
  if (!fullName) return '';
  
  // Clean the name: lowercase, remove special chars except spaces
  const cleaned = fullName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s]/g, '');
  
  const parts = cleaned.split(/\s+/).filter(Boolean);
  
  if (parts.length === 0) {
    return 'user' + Math.floor(Math.random() * 10000);
  }
  
  // Generate variations
  const variations: string[] = [];
  
  // john.doe
  if (parts.length >= 2) {
    variations.push(`${parts[0]}.${parts[parts.length - 1]}`);
  }
  
  // johndoe
  variations.push(parts.join(''));
  
  // john_doe
  if (parts.length >= 2) {
    variations.push(`${parts[0]}_${parts[parts.length - 1]}`);
  }
  
  // john-doe
  if (parts.length >= 2) {
    variations.push(`${parts[0]}-${parts[parts.length - 1]}`);
  }
  
  // j.doe
  if (parts.length >= 2 && parts[0].length > 0) {
    variations.push(`${parts[0][0]}.${parts[parts.length - 1]}`);
  }
  
  // Pick a random variation
  const base = variations[Math.floor(Math.random() * variations.length)] || parts[0];
  
  // Add random numbers for uniqueness
  const randomSuffix = Math.floor(Math.random() * 9999);
  
  return `${base}${randomSuffix}`;
};

// Format username for display
export const formatUsername = (username: string): string => {
  return `@${username}`;
};

// Get validation error message
export const getUsernameError = (username: string): string | null => {
  if (!username) {
    return 'Username is required';
  }
  
  if (username.length < 3) {
    return 'Username must be at least 3 characters';
  }
  
  if (username.length > 30) {
    return 'Username must be 30 characters or less';
  }
  
  if (username.startsWith('.') || username.endsWith('.')) {
    return 'Username cannot start or end with a dot';
  }
  
  if (!/^[a-zA-Z0-9._-]+$/.test(username)) {
    return 'Username can only contain letters, numbers, dots, underscores, and hyphens';
  }
  
  if (username.includes('..')) {
    return 'Username cannot have consecutive dots';
  }
  
  return null;
};
