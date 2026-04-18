const STORAGE_KEY = 'lenski-ai-config'

export interface AIConfig {
  apiKey: string
  baseUrl: string
  model: string
}

const DEFAULT_CONFIG: AIConfig = {
  apiKey: '',
  baseUrl: 'https://api.groq.com/openai/v1',
  model: 'llama-3.3-70b-versatile',
}

export function loadAIConfig(): AIConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return { ...DEFAULT_CONFIG, ...JSON.parse(raw) }
  } catch { /* ignore */ }
  return DEFAULT_CONFIG
}

export function saveAIConfig(config: AIConfig) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
}

export interface GeneratedCard {
  front: string
  back: string
}

export interface GenerateResult {
  deckName: string
  cards: GeneratedCard[]
}

/**
 * Call an OpenAI-compatible API to generate flashcards from a user prompt.
 */
export async function generateDeck(
  prompt: string,
  cardCount: number,
  config: AIConfig,
  onProgress?: (status: string) => void,
): Promise<GenerateResult> {
  if (!config.apiKey) {
    throw new Error('API key not configured. Go to Settings to add your Groq API key.')
  }

  onProgress?.('Generating flashcards...')

  const systemPrompt = `You are a flashcard generator. The user will describe a topic and you will create exactly ${cardCount} flashcards for studying.

Rules:
- Each card has a "front" (question/term/prompt) and a "back" (answer/definition/explanation)
- Keep fronts concise (1-2 sentences max)
- Keep backs informative but brief (1-3 sentences)
- Cards should cover the topic thoroughly and progressively
- Suggest a short deck name based on the topic

Respond with ONLY valid JSON in this exact format, no markdown:
{
  "deckName": "Short Deck Name",
  "cards": [
    { "front": "question or term", "back": "answer or definition" }
  ]
}`

  const url = `${config.baseUrl.replace(/\/+$/, '')}/chat/completions`

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 4096,
    }),
  })

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    if (response.status === 401) {
      throw new Error('Invalid API key. Check your key in Settings.')
    }
    if (response.status === 429) {
      throw new Error('Rate limited. Wait a moment and try again.')
    }
    throw new Error(`API error ${response.status}: ${body.slice(0, 200)}`)
  }

  onProgress?.('Parsing response...')

  const data = await response.json()
  const content = data.choices?.[0]?.message?.content ?? ''

  // Parse JSON — handle potential markdown code fences
  const jsonStr = content.replace(/^```json?\s*/i, '').replace(/\s*```$/i, '').trim()

  let parsed: GenerateResult
  try {
    parsed = JSON.parse(jsonStr)
  } catch {
    throw new Error('Failed to parse AI response. Try again with a simpler prompt.')
  }

  if (!parsed.deckName || !Array.isArray(parsed.cards) || parsed.cards.length === 0) {
    throw new Error('AI returned an invalid deck format. Try again.')
  }

  // Validate and clean cards
  const cards = parsed.cards
    .filter((c: any) => typeof c.front === 'string' && typeof c.back === 'string')
    .map((c: any) => ({ front: c.front.trim(), back: c.back.trim() }))
    .filter((c: GeneratedCard) => c.front && c.back)

  if (cards.length === 0) {
    throw new Error('AI generated no valid cards. Try a different prompt.')
  }

  return { deckName: parsed.deckName, cards }
}
