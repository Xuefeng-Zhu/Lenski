import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { Card, Button, Input, Textarea, Select, useDrawerHeader } from 'even-toolkit/web'
import { useFlashcards } from '../contexts/FlashcardContext'

export function AddCardScreen() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { decks, addCard, addDeck } = useFlashcards()

  const preselectedDeck = searchParams.get('deck') ?? ''
  const [deckId, setDeckId] = useState(preselectedDeck || (decks[0]?.id ?? ''))
  const [front, setFront] = useState('')
  const [back, setBack] = useState('')
  const [saved, setSaved] = useState(false)

  useDrawerHeader({ title: 'Add Card', backTo: deckId ? `/deck/${deckId}` : '/decks' })

  const deckOptions = decks.map((d) => ({ value: d.id, label: d.name }))

  function handleSave() {
    const f = front.trim()
    const b = back.trim()
    if (!f || !b) return

    let targetDeck = deckId
    if (!targetDeck) {
      // Auto-create a default deck
      const deck = addDeck('My Cards')
      targetDeck = deck.id
      setDeckId(deck.id)
    }

    addCard(targetDeck, f, b)
    setFront('')
    setBack('')
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <main className="px-3 pt-4 pb-8 space-y-3">
      <Card className="p-4 space-y-3">
        <p className="text-[15px] tracking-[-0.15px] text-text">Add Flashcard</p>

        {decks.length > 0 && (
          <div className="space-y-1.5">
            <label className="text-[11px] tracking-[-0.11px] text-text-dim block">Deck</label>
            <Select
              options={deckOptions}
              value={deckId}
              onValueChange={setDeckId}
            />
          </div>
        )}

        <div className="space-y-1.5">
          <label className="text-[11px] tracking-[-0.11px] text-text-dim block">Front (question)</label>
          <Textarea
            value={front}
            onChange={(e) => setFront(e.target.value)}
            placeholder="What is the capital of France?"
            rows={3}
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-[11px] tracking-[-0.11px] text-text-dim block">Back (answer)</label>
          <Textarea
            value={back}
            onChange={(e) => setBack(e.target.value)}
            placeholder="Paris"
            rows={3}
          />
        </div>

        <div className="flex gap-2">
          <Button onClick={handleSave} disabled={!front.trim() || !back.trim()}>
            {saved ? '✓ Saved!' : 'Add Card'}
          </Button>
          <Button variant="secondary" onClick={() => navigate(deckId ? `/deck/${deckId}` : '/decks')}>
            Done
          </Button>
        </div>
      </Card>

      {/* Preview */}
      {(front.trim() || back.trim()) && (
        <Card className="p-4 space-y-2">
          <p className="text-[11px] tracking-[-0.11px] text-text-dim">Preview</p>
          <div className="rounded-[6px] bg-surface p-3 text-center">
            <p className="text-[11px] tracking-[-0.11px] text-text-muted mb-1">FRONT</p>
            <p className="text-[15px] tracking-[-0.15px] text-text">{front || '...'}</p>
          </div>
          <div className="rounded-[6px] bg-surface p-3 text-center">
            <p className="text-[11px] tracking-[-0.11px] text-text-muted mb-1">BACK</p>
            <p className="text-[15px] tracking-[-0.15px] text-text">{back || '...'}</p>
          </div>
        </Card>
      )}
    </main>
  )
}
