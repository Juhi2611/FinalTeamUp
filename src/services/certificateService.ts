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
export const analyzeCertificate = async (
  imageBase64: string,
  profileName: string,
  profileSkills: string[]
): Promise<CertificateAnalysisResult> => {
  const res = await fetch('http://localhost:3001/api/analyzeCertificate', {
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
