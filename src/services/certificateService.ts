export interface CertificateAnalysisResult {
  extractedName: string;
  inferredSkills: string[];
  courseTopics: string[];
  nameMatch: boolean;
  reason: string;
}

/**
 * Calls certificate analysis endpoint (local server in dev, Vercel function in production)
 */
export const analyzeCertificate = async (
  imageBase64: string,
  profileName: string,
  profileSkills: string[]
): Promise<CertificateAnalysisResult> => {
  // Use Vercel function in production, local server in development
  const apiUrl = import.meta.env.PROD 
    ? '/api/analyzeCertificate'  // Vercel serverless function
    : 'http://localhost:3001/api/analyzeCertificate';  // Local Express server

  const res = await fetch(apiUrl, {
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
