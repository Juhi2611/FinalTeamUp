// D:\TeamUp-main\functions\analyzeCertificate.ts
// Server-side proxy for Gemini certificate analysis

import type { IncomingMessage, ServerResponse } from 'http';

/* ======================================================
   TEXT NORMALIZATION / NAME MATCHING (OLD LOGIC)
====================================================== */
function normalize(str = '') {
  return str.toLowerCase().replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function normalizeWords(str: string) {
  return normalize(str).split(' ').filter(Boolean);
}

function isNameMatch(extractedName: string, profileName: string) {
  const ocrWords = new Set(normalizeWords(extractedName));
  const profileWords = normalizeWords(profileName);
  return profileWords.every(word => ocrWords.has(word));
}

/* ======================================================
   HANDLER
====================================================== */
export default async function handler(
  req: IncomingMessage & { body?: any },
  res: ServerResponse
) {
  // Only accept POST
  if (req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }

  // Read raw body
  let body = '';
  req.on('data', chunk => (body += chunk));
  await new Promise<void>(resolve => req.on('end', resolve));

  let parsedBody: { imageBase64?: string; profileName?: string };
  try {
    parsedBody = JSON.parse(body);
  } catch {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Invalid JSON body' }));
    return;
  }

  const { imageBase64, profileName } = parsedBody;

  if (!imageBase64 || !profileName) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Missing image or profile name' }));
    return;
  }

  const GEMINI_API_KEY = process.env.VITE_GEMINI_API_KEY;
  if (!GEMINI_API_KEY) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Gemini API key not configured' }));
    return;
  }

  try {
    // Use latest stable Gemini model
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

Return ONLY valid JSON in this exact format:
{
  "extractedName": "Full Name",
  "courseTopics": ["Topic 1", "Topic 2"]
}
                `.trim(),
                },
                { inline_data: { mime_type: 'image/jpeg', data: imageBase64 } },
              ],
            },
          ],
          generationConfig: { temperature: 0.3, maxOutputTokens: 1024 },
        }),
      }
    );

    const data = await response.json();

    const extractedName = data.extractedName || 'Unknown';
    const courseTopics = data.courseTopics || [];

    // 🔥 Run your old name verification logic
    const nameMatch = isNameMatch(extractedName, profileName);
    const reason = nameMatch
      ? 'Certificate name matches profile'
      : 'Name verification failed, please check manually';

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      extractedName,
      courseTopics,
      nameMatch,
      reason,
    }));
  } catch (err) {
    console.error('Gemini server error:', err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Gemini API request failed' }));
  }
}
