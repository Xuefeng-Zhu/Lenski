import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router'
import { Card, Button, Badge, Input, Textarea, ScreenHeader, useDrawerHeader } from 'even-toolkit/web'
import { Slider } from 'even-toolkit/web/slider'
import { useFlashcards } from '../contexts/FlashcardContext'
import { generateDeck, loadAIConfig, type GeneratedCard } from '../ai/generate'

const EXAMPLE_PROMPTS = [
  'Top 30 Spanish travel phrases',
  'Key concepts in machine learning',
  'Japanese food vocabulary',
  'US Presidents and their terms',
  'Common French false friends',
  'AWS Solutions Architect key services',
  'Music theory basics',
  'Organic chemistry functional groups',
]

type ScreenState =
  | { step: 'prompt' }
  | { step: 'generating'; status: string }
  | { step: 'preview'; deckName: string; cards: GeneratedCard[] }
  | { step: 'done'; deckName: string; count: number }
  | { step: 'error'; message: string }

export function GenerateScreen() {
  const navigate = useNavigate()
  const { addDeck, addCard } = useFlashcards()

  const [prompt, setPrompt] = useState('')
  const [cardCount, setCardCount] = useState(20)
  const [state, setState] = useState<ScreenState>({ step: 'prompt' })

  useDrawerHeader({ title: 'AI Generate', backTo: '/decks' })

  const handleGenerate = useCallback(async () => {
    const text = prompt.trim()
    if (!text) return

    const config = loadAIConfig()
    if (!config.apiKey) {
      setState({ step: 'error', message: 'API key not configured. Go to Settings → AI to add your Groq API key.' })
      return
    }

    setState({ step: 'generating', status: 'Connecting to AI...' })

    try {
      const result = await generateDeck(text, cardCount, config, (status) => {
        setState({ step: 'generating', status })
      })
      setState({ step: 'preview', deckName: result.deckName, cards: result.cards })
    } catch (err) {
      setState({ step: 'error', message: err instanceof Error ? err.message : 'Generation failed.' })
    }
  }, [prompt, cardCount])

  const handleImport = useCallback(() => {
    if (state.step !== 'preview') return

    const deck = addDeck(state.deckName)
    for (const card of state.cards) {
      addCard(deck.id, card.front, card.back)
    }
    setState({ step: 'done', deckName: state.deckName, count: state.cards.length })
  }, [state, addDeck, addCard])

  const handleReset = useCallback(() => {
    setState({ step: 'prompt' })
  }, [])

  return (
    <main className="px-3 pt-4 pb-8 space-y-3">
      <ScreenHeader
        title="AI Generate"
        subtitle="Create flashcards with AI"
      />

      {/* Prompt input */}
      {(state.step === 'prompt' || state.step === 'error') && (
        <>
          <Card className="p-4 space-y-3">
            <p className="text-[13px] tracking-[-0.13px] text-text-dim">
              Describe what you want to study and AI will generate a deck of flashcards.
            </p>

            <div className="space-y-1.5">
              <label className="text-[11px] tracking-[-0.11px] text-text-dim block">Topic</label>
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="e.g. Top 30 Spanish travel phrases"
                rows={3}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] tracking-[-0.11px] text-text-dim block">
                Number of cards: {cardCount}
              </label>
              <Slider
                value={cardCount}
                onChange={setCardCount}
                min={5}
                max={50}
                step={5}
              />
            </div>

            <Button
              className="w-full"
              onClick={handleGenerate}
              disabled={!prompt.trim()}
            >
              Generate Deck
            </Button>
          </Card>

          {/* Example prompts */}
          <Card className="p-4 space-y-2">
            <p className="text-[11px] tracking-[-0.11px] text-text-dim">Try one of these:</p>
            <div className="flex flex-wrap gap-1.5">
              {EXAMPLE_PROMPTS.map((ex) => (
                <button
                  key={ex}
                  className="text-[11px] tracking-[-0.11px] text-accent bg-surface rounded-[6px] px-2 py-1 hover:bg-surface-light"
                  onClick={() => setPrompt(ex)}
                >
                  {ex}
                </button>
              ))}
            </div>
          </Card>

          {state.step === 'error' && (
            <Card className="p-4">
              <div className="rounded-[6px] bg-negative-alpha p-3">
                <p className="text-[13px] tracking-[-0.13px] text-negative">{state.message}</p>
              </div>
            </Card>
          )}
        </>
      )}

      {/* Generating */}
      {state.step === 'generating' && (
        <Card className="p-4 space-y-3 text-center">
          <p className="text-[40px]">🧠</p>
          <p className="text-[15px] tracking-[-0.15px] text-text">{state.status}</p>
          <p className="text-[11px] tracking-[-0.11px] text-text-dim">
            This may take a few seconds...
          </p>
        </Card>
      )}

      {/* Preview */}
      {state.step === 'preview' && (
        <>
          <Card className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-[15px] tracking-[-0.15px] text-text">{state.deckName}</p>
              <Badge variant="accent">{state.cards.length} cards</Badge>
            </div>
            <p className="text-[11px] tracking-[-0.11px] text-text-dim">
              Review the generated cards below, then add them to your collection.
            </p>
          </Card>

          <div className="space-y-2">
            {state.cards.map((card, i) => (
              <Card key={i} className="p-3 space-y-1">
                <p className="text-[13px] tracking-[-0.13px] text-text">{card.front}</p>
                <p className="text-[11px] tracking-[-0.11px] text-text-dim">{card.back}</p>
              </Card>
            ))}
          </div>

          <div className="flex gap-2">
            <Button className="flex-1" onClick={handleImport}>
              Add to Collection
            </Button>
            <Button className="flex-1" variant="secondary" onClick={handleReset}>
              Try Again
            </Button>
          </div>
        </>
      )}

      {/* Done */}
      {state.step === 'done' && (
        <Card className="p-4 space-y-3 text-center">
          <p className="text-[40px]">✅</p>
          <p className="text-[15px] tracking-[-0.15px] text-text">
            Created "{state.deckName}"
          </p>
          <p className="text-[13px] tracking-[-0.13px] text-text-dim">
            {state.count} cards added to your collection.
          </p>
          <div className="flex gap-2 justify-center">
            <Button onClick={() => navigate('/')}>Study Now</Button>
            <Button variant="secondary" onClick={handleReset}>Generate More</Button>
          </div>
        </Card>
      )}
    </main>
  )
}
