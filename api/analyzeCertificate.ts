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
      `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash-latest:generateContent?key=${GEMINI_API_KEY}`,
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

