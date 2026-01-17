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
