export interface CertificateAnalysisResult {
  extractedName: string;
  inferredSkills: string[];
  courseTopics: string[];
  nameMatch: boolean;
  reason: string;
}

/**
 * Calls server.js certificate analysis endpoint
 */
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export const analyzeCertificate = async (
  imageBase64: string,
  profileName: string,
  profileSkills: string[]
): Promise<CertificateAnalysisResult> => {
  const res = await fetch(`${API_URL}/api/analyzeCertificate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      imageBase64,
      profileName,
      profileSkills,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error('Certificate analysis API error:', errText);
    throw new Error('Certificate analysis request failed');
  }

  const data = await res.json();

  return {
    ...data,
    courseTopics: data.courseTopics ?? [],
  };
};
