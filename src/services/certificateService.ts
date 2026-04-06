// src/services/certificateService.ts

export interface CertificateAnalysisResult {
  extractedName: string;
  inferredSkills: string[];
  courseTopics: string[];
  nameMatch: boolean;
  reason: string;
}

/**
 * Calls certificate analysis API (works on both localhost and Vercel)
 */
export const analyzeCertificate = async (
  ocrText: string,
  profileName: string,
  profileSkills: string[]
): Promise<CertificateAnalysisResult> => {
  // Use relative URL - works on Vercel and local (with vercel dev)
  const apiUrl = '/api/analyzeCertificate';

  const res = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ocrText,
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

