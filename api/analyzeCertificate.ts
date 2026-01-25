// api/analyzeCertificate.ts
// Vercel Serverless Function for Certificate Analysis (uses Tesseract.js)

import type { VercelRequest, VercelResponse } from '@vercel/node';

// Text normalization
function normalize(str = ''): string {
  return str
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeWords(str: string): string[] {
  return normalize(str).split(' ').filter(Boolean);
}

function isNameMatch(ocrText: string, profileName: string): boolean {
  const ocrWords = new Set(normalizeWords(ocrText));
  const profileWords = normalizeWords(profileName);
  return profileWords.every(word => ocrWords.has(word));
}

function extractMatchingName(ocrText: string, profileName: string): string {
  const profileWords = normalizeWords(profileName);
  const ocrWords = normalizeWords(ocrText);
  return profileWords.filter(w => ocrWords.includes(w)).join(' ') || 'Unknown';
}

function inferSkillsFromUserProfile(text: string, profileSkills: string[] = []): string[] {
  const cleanText = normalize(text);
  const matchedSkills = new Set<string>();

  for (const skill of profileSkills) {
    const normalizedSkill = normalize(skill);
    if (normalizedSkill.length < 3) continue;
    if (cleanText.includes(normalizedSkill)) {
      matchedSkills.add(skill);
    }
  }

  return Array.from(matchedSkills);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { imageBase64, profileName, profileSkills = [] } = req.body;

    if (!imageBase64 || !profileName) {
      return res.status(400).json({ error: 'Missing required data (imageBase64 or profileName)' });
    }

    // Dynamic import of Tesseract.js for serverless
    const Tesseract = await import('tesseract.js');

    // Convert base64 to buffer
    const imageBuffer = Buffer.from(imageBase64, 'base64');

    // Run OCR
    const { data: { text } } = await Tesseract.recognize(imageBuffer, 'eng', {
      logger: () => {} // Suppress logs
    });

    const nameMatch = isNameMatch(text, profileName);
    const extractedName = extractMatchingName(text, profileName);
    const inferredSkills = inferSkillsFromUserProfile(text, profileSkills);

    return res.status(200).json({
      extractedName,
      inferredSkills,
      courseTopics: [],
      nameMatch,
      reason: nameMatch
        ? inferredSkills.length > 0
          ? 'Certificate matches profile skills'
          : 'Name verified, but no profile skills matched'
        : 'Name does not match profile, verify manually',
    });
  } catch (err: any) {
    console.error('Certificate analysis error:', err);
    return res.status(500).json({ error: err.message || 'Certificate analysis failed' });
  }
}
