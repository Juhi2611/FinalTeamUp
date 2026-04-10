import rawCities from '../data/cities.json';

export interface CityData {
  id: string;
  name: string;
  state: string;
  country: string;
  displayName: string;
}

// Enhance raw cities with country and displayName
export const cities: CityData[] = (rawCities as any[]).map((city) => ({
  id: `city_${city.id}_${city.name.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
  name: city.name,
  state: city.state,
  country: 'India',
  displayName: `${city.name}, ${city.state}`
}));

// Quick lookup map for O(1) reads
const cityMap = new Map<string, CityData>();
cities.forEach(city => {
  cityMap.set(city.id, city);
});

// Common normalization mappings (e.g. historical names or common typos)
const NORMALIZATION_MAP: Record<string, string> = {
  'bombay': 'mumbai',
  'bangalore': 'bengaluru',
  'calcutta': 'kolkata',
  'madras': 'chennai',
  'trivandrum': 'thiruvananthapuram',
  'poona': 'pune',
  'gurgaon': 'gurugram',
  'baroda': 'vadodara',
  'gonda': 'gonda',
  'pondy': 'puducherry',
  'pondicherry': 'puducherry'
};

/**
 * Searches for cities based on a query. Supports partial matching.
 */
export const searchCities = (query: string): CityData[] => {
  if (!query || query.trim().length === 0) return cities.slice(0, 100); // Return top 100 by default

  const lowerQuery = query.toLowerCase().trim();
  
  // Exact name matches prioritized
  const exactMatches = cities.filter(city => city.name.toLowerCase() === lowerQuery);
  
  // Partial matches
  const partialMatches = cities.filter(city => 
    city.displayName.toLowerCase().includes(lowerQuery) &&
    city.name.toLowerCase() !== lowerQuery
  );

  return [...exactMatches, ...partialMatches].slice(0, 50); // Limit results for performance
};

/**
 * Gets city by ID.
 */
export const getCityById = (id: string): CityData | undefined => {
  return cityMap.get(id);
};

/**
 * Normalizes a raw string input into a CityData object using our mappings.
 * Uses best-effort matching.
 */
export const normalizeCityString = (input: string): CityData | null => {
  if (!input) return null;
  const cleaned = input.toLowerCase().trim();
  
  // Check exact mapping first
  const mappedName = NORMALIZATION_MAP[cleaned] || cleaned;

  // Exact match
  let matched = cities.find(c => c.name.toLowerCase() === mappedName);
  
  // Try partial match if exact fails
  if (!matched) {
    matched = cities.find(c => c.name.toLowerCase().includes(mappedName));
  }
  
  return matched || null;
};
