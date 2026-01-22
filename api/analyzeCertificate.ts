import type { IncomingMessage, ServerResponse } from 'http';

export default async function handler(
  req: IncomingMessage & { body?: any },
  res: ServerResponse
) {
  // Only allow POST
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }

  // Read raw body (Vercel-compatible)
  let body = '';
  req.on('data', chunk => {
    body += chunk;
  });

  await new Promise<void>(resolve => req.on('end', resolve));

  let parsedBody: {
    imageBase64?: string;
    profileName?: string;
  };

  try {
    parsedBody = JSON.parse(body);
  } catch {
    res.statusCode = 400;
    res.end(JSON.stringify({ error: 'Invalid JSON body' }));
    return;
  }

  const { imageBase64, profileName } = parsedBody;

  if (!imageBase64 || !profileName) {
    res.statusCode = 400;
    res.end(JSON.stringify({ error: 'Missing image or profile name' }));
    return;
  }

  // ⚠️ KEEPING YOUR EXISTING ENV VAR
  const GEMINI_API_KEY = process.env.VITE_GEMINI_API_KEY;

  if (!GEMINI_API_KEY) {
    res.statusCode = 500;
    res.end(JSON.stringify({ error: 'Gemini API key not configured' }));
    return;
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `
Analyze the certificate image and extract:
1. Person's full name
2. Course or certification topics

Compare extracted name with: "${profileName}"
Names should match even if order differs.

Return ONLY valid JSON in this exact format:
{
  "extractedName": "Full Name",
  "courseTopics": ["Topic 1", "Topic 2"],
  "nameMatch": true,
  "reason": "Short explanation"
}
                  `.trim(),
                },
                {
                  inline_data: {
                    mime_type: 'image/jpeg',
                    data: imageBase64,
                  },
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 1024,
          },
        }),
      }
    );

    const data = await response.json();

    res.statusCode = response.ok ? 200 : 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(data));
  } catch (err) {
    console.error('Gemini server error:', err);
    res.statusCode = 500;
    res.end(JSON.stringify({ error: 'Gemini API request failed' }));
  }
}

CertificateService.ts:

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

And btw TILL WHEN WILL I HAVE TO IGNORE SERVER.JS?????


server.js:
// server.js
import express from 'express';
import cors from 'cors';
import Tesseract from 'tesseract.js';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

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
function normalizeWords(str) {
  return normalize(str).split(' ').filter(Boolean);
}

function isNameMatch(ocrText, profileName) {
  const ocrWords = new Set(normalizeWords(ocrText));
  const profileWords = normalizeWords(profileName);
  return profileWords.every(word => ocrWords.has(word));
}

function extractMatchingName(ocrText, profileName) {
  const profileWords = normalizeWords(profileName);
  const ocrWords = normalizeWords(ocrText);
  return profileWords.filter(w => ocrWords.includes(w)).join(' ') || 'Unknown';
}

/* ======================================================
   USER-SKILL MATCHING (ONLY SOURCE OF TRUTH)
====================================================== */
function inferSkillsFromUserProfile(text, profileSkills = []) {
  const cleanText = normalize(text);
  const matchedSkills = new Set();

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
   API
====================================================== */
app.post('/api/analyzeCertificate', async (req, res) => {
  try {
    const { imageBase64, profileName, profileSkills = [] } = req.body;

    if (!imageBase64 || !profileName) {
      return res.status(400).json({ error: 'Missing data' });
    }

    const {
      data: { text },
    } = await Tesseract.recognize(
      Buffer.from(imageBase64, 'base64'),
      'eng'
    );

    const nameMatch = isNameMatch(text, profileName);
    const extractedName = extractMatchingName(text, profileName);

    // 🔥 ONLY LOGIC: certificate text vs user's own skills
    const inferredSkills = inferSkillsFromUserProfile(text, profileSkills);

    return res.json({
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
    console.error(err);
    return res.status(500).json({ error: 'Certificate analysis failed' });
  }
});

/* ======================================================
   START
====================================================== */
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
}); 
