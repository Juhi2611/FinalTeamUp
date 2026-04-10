export interface InstitutionData {
  id: string;
  name: string;
  district: string;
  displayName: string;
}

let cachedInstitutions: InstitutionData[] | null = null;
let institutionMap: Map<string, InstitutionData> | null = null;

const loadInstitutions = async () => {
  if (cachedInstitutions) return cachedInstitutions;

  const module = await import('../data/institutions.json');
  const rawData = module.default || module;

  cachedInstitutions = (rawData as any[]).map(inst => {
    const name = (inst.institute_name || '').trim();
    const district = (inst.district || '').trim();
    return {
      id: inst.aicte_id || `inst_${Math.random().toString(36).substr(2, 9)}`,
      name,
      district,
      displayName: district ? `${name}, ${district}` : name,
    };
  });

  institutionMap = new Map();
  cachedInstitutions.forEach(inst => {
    institutionMap!.set(inst.id, inst);
  });

  return cachedInstitutions;
};

export const searchInstitutions = async (query: string): Promise<InstitutionData[]> => {
  const institutions = await loadInstitutions();

  if (!query || query.trim().length === 0) return institutions.slice(0, 100);

  const lowerQuery = query.toLowerCase().trim();

  const exactMatches: InstitutionData[] = [];
  const startsWithMatches: InstitutionData[] = [];
  const otherMatches: InstitutionData[] = [];

  // No early break — scan ALL institutions so partial queries like "L. J." work correctly
  for (const inst of institutions) {
    const nameLower = inst.name.toLowerCase();
    const districtLower = inst.district.toLowerCase();

    if (nameLower === lowerQuery) {
      exactMatches.push(inst);
    } else if (nameLower.startsWith(lowerQuery) || districtLower.startsWith(lowerQuery)) {
      startsWithMatches.push(inst);
    } else if (nameLower.includes(lowerQuery) || districtLower.includes(lowerQuery)) {
      otherMatches.push(inst);
    }
  }

  return [...exactMatches, ...startsWithMatches, ...otherMatches].slice(0, 50);
};

export const getInstitutionById = async (id: string): Promise<InstitutionData | undefined> => {
  await loadInstitutions();
  return institutionMap?.get(id);
};

export const normalizeInstitutionString = async (input: string): Promise<InstitutionData | null> => {
  if (!input) return null;
  const institutions = await loadInstitutions();
  const cleaned = input.toLowerCase().trim();

  let matched = institutions.find(c => c.name.toLowerCase() === cleaned);
  if (!matched) {
    matched = institutions.find(c => c.name.toLowerCase().includes(cleaned));
  }

  return matched || null;
};