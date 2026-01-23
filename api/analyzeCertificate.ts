import type { IncomingMessage, ServerResponse } from 'http';
import { VertexAI } from '@google-cloud/vertexai';

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

  // ✅ REPLACEMENT: service account auth (NO API KEY)
  if (!process.env.GCP_SERVICE_ACCOUNT) {
    res.statusCode = 500;
    res.end(JSON.stringify({ error: 'GCP service account not configured' }));
    return;
  }

  try {
    const credentials = JSON.parse(process.env.GCP_SERVICE_ACCOUNT);

    process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON =
    process.env.GCP_SERVICE_ACCOUNT;

    const vertex = new VertexAI({
      project: credentials.project_id,
      location: 'us-central1',
    });


    const model = vertex.getGenerativeModel({
      model: 'gemini-1.5-flash',
    });

    const result = await model.generateContent({
      contents: [
        {
          role: 'user',
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
              inlineData: {
                mimeType: 'image/jpeg',
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
    });

    const text =
      result.response.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ raw: text }));
  } catch (err) {
    console.error('Gemini server error:', err);
    res.statusCode = 500;
    res.end(JSON.stringify({ error: 'Gemini API request failed' }));
  }
}
