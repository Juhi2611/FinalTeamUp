// =============================================================
// services/openai_quiz.ts
// Quiz generation using Groq API (free tier - 14,400 req/day)
// Set VITE_OPENAI_API_KEY=your_groq_api_key in .env
// Get your key at: https://console.groq.com
// =============================================================

export interface GeneratedQuestion {
  question: string;
  options: string[];
  correct_answer: string;
}

export interface QuizGenerationConfig {
  topics: string[];
  difficulty: 'easy' | 'medium' | 'hard';
  numQuestions: number;
}

export const generateQuizQuestions = async (
  config: QuizGenerationConfig
): Promise<GeneratedQuestion[]> => {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
  if (!apiKey) throw new Error('API key not configured (VITE_OPENAI_API_KEY)');

  const prompt = `Generate exactly ${config.numQuestions} multiple-choice questions for a technical interview.

Topics: ${config.topics.join(', ')}
Difficulty: ${config.difficulty}

Rules:
- Each question must have exactly 4 options
- One correct answer per question
- Test practical knowledge, not just definitions
- No duplicate questions

Respond ONLY with a valid JSON array. No markdown, no explanation, no preamble.
[
  {
    "question": "Question text here?",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correct_answer": "Option A"
  }
]`;

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content: 'You are a technical interview question generator. Respond only with valid JSON arrays. No extra text, no markdown, no explanation.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 4096,
    }),
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error?.message || `Groq API error: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content?.trim();

  if (!content) throw new Error('Empty response from Groq');

  // Strip markdown fences if present
  const clean = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();

  try {
    const questions: GeneratedQuestion[] = JSON.parse(clean);
    if (!Array.isArray(questions)) throw new Error('Response is not an array');
    console.log(`✅ Quiz generated: ${questions.length} questions`);
    return questions.slice(0, config.numQuestions);
  } catch {
    throw new Error('Failed to parse quiz questions from Groq response');
  }
};