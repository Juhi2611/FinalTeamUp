// api/analyzeCertificate.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import Tesseract from 'tesseract.js';

/* ======================================================
   TEXT NORMALIZATION
====================================================== */
function normalize(str = '') {
  return str
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/* ======================================================
   NAME MATCHING (DO NOT TOUCH)
====================================================== */
function normalizeWords(str: string) {
  return normalize(str).split(' ').filter(Boolean);
}

function isNameMatch(ocrText: string, profileName: string) {
  const ocrWords = new Set(normalizeWords(ocrText));
  const profileWords = normalizeWords(profileName);
  return profileWords.every(word => ocrWords.has(word));
}

function extractMatchingName(ocrText: string, profileName: string) {
  const profileWords = normalizeWords(profileName);
  const ocrWords = normalizeWords(ocrText);
  return profileWords.filter(w => ocrWords.includes(w)).join(' ') || 'Unknown';
}

/* ======================================================
   USER-SKILL MATCHING (ONLY SOURCE OF TRUTH)
====================================================== */
function inferSkillsFromUserProfile(text: string, profileSkills: string[] = []) {
  const cleanText = normalize(text);
  const matchedSkills = new Set<string>();

  for (const skill of profileSkills) {
    const normalizedSkill = normalize(skill);
    // Ignore junk / ultra-short skills
    if (normalizedSkill.length < 3) continue;
    if (cleanText.includes(normalizedSkill)) {
      matchedSkills.add(skill);
    }
  }

  return Array.from(matchedSkills);
}

/* ======================================================
   VERCEL SERVERLESS FUNCTION
====================================================== */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // Handle OPTIONS request
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Only accept POST
  if (req.method !== 'POST') {
    console.error('Invalid method:', req.method);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('Starting certificate analysis...');
    const { imageBase64, profileName, profileSkills = [] } = req.body;

    if (!imageBase64 || !profileName) {
      console.error('Missing data - imageBase64:', !!imageBase64, 'profileName:', !!profileName);
      return res.status(400).json({ error: 'Missing data' });
    }

    console.log('Processing OCR...');
    const {
      data: { text },
    } = await Tesseract.recognize(
      Buffer.from(imageBase64, 'base64'),
      'eng'
    );

    console.log('OCR completed, text length:', text.length);

    const nameMatch = isNameMatch(text, profileName);
    const extractedName = extractMatchingName(text, profileName);

    // 🔥 ONLY LOGIC: certificate text vs user's own skills
    const inferredSkills = inferSkillsFromUserProfile(text, profileSkills);

    console.log('Analysis complete - nameMatch:', nameMatch, 'inferredSkills:', inferredSkills.length);

    return res.status(200).json({
      extractedName,
      inferredSkills,
      courseTopics: [], // kept for type safety / future use
      nameMatch,
      reason: nameMatch
        ? inferredSkills.length > 0
          ? 'Certificate matches profile skills'
          : 'Name verified, but no profile skills matched'
        : 'Name does not match profile, verify manually',
    });
  } catch (err) {
    console.error('Certificate analysis error:', err);
    return res.status(500).json({ 
      error: 'Certificate analysis failed',
      details: err instanceof Error ? err.message : String(err)
    });
  }
}
