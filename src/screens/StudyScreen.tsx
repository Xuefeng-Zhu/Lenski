import { useState, useMemo, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router'
import { Card, Button, Badge, ScreenHeader, useDrawerHeader } from 'even-toolkit/web'
import { useFlashcards } from '../contexts/FlashcardContext'
import type { Rating } from '../types'
import { RATING_LABELS } from '../types'

export function StudyScreen() {
  const navigate = useNavigate()
  const { decks, getDueCards, reviewCard, getTotalDue } = useFlashcards()

  const [selectedDeck, setSelectedDeck] = useState<string | null>(null)
  const [showAnswer, setShowAnswer] = useState(false)
  const [cardIndex, setCardIndex] = useState(0)

  // Session tracking
  const sessionRef = useRef<{ total: number; correct: number; ratings: Rating[] }>({ total: 0, correct: 0, ratings: [] })

  const dueCards = useMemo(
    () => getDueCards(selectedDeck ?? undefined),
    [getDueCards, selectedDeck],
  )

  const currentCard = dueCards[cardIndex] ?? null
  const totalDue = getTotalDue()

  useDrawerHeader({})

  const handleRate = useCallback((rating: Rating) => {
    if (!currentCard) return
    reviewCard(currentCard.id, rating)
    sessionRef.current.total++
    if (rating >= 3) sessionRef.current.correct++
    sessionRef.current.ratings.push(rating)
    setShowAnswer(false)
    setCardIndex((prev) => Math.min(prev, Math.max(0, dueCards.length - 2)))
  }, [currentCard, reviewCard, dueCards.length])

  // Deck selection view
  if (selectedDeck === null) {
    return (
      <main className="px-3 pt-4 pb-8 space-y-3">
        <ScreenHeader
          title="Study"
          subtitle={`${totalDue} card${totalDue !== 1 ? 's' : ''} due today`}
        />

        {/* Study all */}
        <Card className="p-4">
          <Button className="w-full" onClick={() => setSelectedDeck('')}>
            Study All Due ({totalDue})
          </Button>
        </Card>

        {/* Per-deck */}
        <div className="space-y-2">
          {decks.map((deck) => {
            const due = getDueCards(deck.id).length
            return (
              <Card key={deck.id} className="p-4">
                <button
                  className="w-full flex items-center justify-between text-left"
                  onClick={() => { setSelectedDeck(deck.id); setCardIndex(0); setShowAnswer(false) }}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: deck.color }}
                    />
                    <span className="text-[15px] tracking-[-0.15px] text-text">{deck.name}</span>
                  </div>
                  <Badge variant={due > 0 ? 'accent' : 'neutral'}>
                    {due} due
                  </Badge>
                </button>
              </Card>
            )
          })}
        </div>

        {decks.length === 0 && (
          <Card className="p-4">
            <p className="text-[13px] tracking-[-0.13px] text-text-dim text-center">
              No decks yet. Create one to start studying.
            </p>
            <Button className="w-full mt-3" variant="secondary" onClick={() => navigate('/decks')}>
              Go to Decks
            </Button>
          </Card>
        )}
      </main>
    )
  }

  // No cards due
  if (!currentCard) {
    const session = sessionRef.current
    const accuracy = session.total > 0 ? Math.round((session.correct / session.total) * 100) : 0

    return (
      <main className="px-3 pt-4 pb-8 space-y-3">
        <ScreenHeader
          title="Done!"
          subtitle="No more cards due right now"
        />
        <Card className="p-4 space-y-3 text-center">
          <p className="text-[40px]">🎉</p>
          {session.total > 0 ? (
            <>
              <p className="text-[15px] tracking-[-0.15px] text-text">
                Reviewed {session.total} card{session.total !== 1 ? 's' : ''}
              </p>
              <div className="flex items-center justify-around">
                <div>
                  <p className="text-[20px] tracking-[-0.2px] text-positive">{accuracy}%</p>
                  <p className="text-[11px] tracking-[-0.11px] text-text-dim">Accuracy</p>
                </div>
                <div>
                  <p className="text-[20px] tracking-[-0.2px] text-accent">{session.correct}</p>
                  <p className="text-[11px] tracking-[-0.11px] text-text-dim">Correct</p>
                </div>
                <div>
                  <p className="text-[20px] tracking-[-0.2px] text-negative">{session.total - session.correct}</p>
                  <p className="text-[11px] tracking-[-0.11px] text-text-dim">Missed</p>
                </div>
              </div>
            </>
          ) : (
            <p className="text-[13px] tracking-[-0.13px] text-text-dim">
              Great job! Come back later for more reviews.
            </p>
          )}
          <div className="flex gap-2 justify-center">
            <Button onClick={() => { setSelectedDeck(null); setCardIndex(0); sessionRef.current = { total: 0, correct: 0, ratings: [] } }}>
              Back to Decks
            </Button>
            <Button variant="secondary" onClick={() => navigate('/stats')}>
              View Stats
            </Button>
          </div>
        </Card>
      </main>
    )
  }

  const deckName = decks.find((d) => d.id === currentCard.deckId)?.name ?? 'All Decks'
  const remaining = dueCards.length

  // Study view
  return (
    <main className="px-3 pt-4 pb-8 space-y-3">
      <div className="flex items-center justify-between">
        <button
          className="text-[13px] tracking-[-0.13px] text-accent"
          onClick={() => { setSelectedDeck(null); setCardIndex(0); setShowAnswer(false) }}
        >
          ← Back
        </button>
        <Badge variant="neutral">{remaining} remaining</Badge>
      </div>

      <p className="text-[11px] tracking-[-0.11px] text-text-dim">{selectedDeck === '' ? 'All Decks' : deckName}</p>

      {/* Card */}
      <Card className="p-6 min-h-[200px] flex flex-col items-center justify-center text-center">
        <p className="text-[11px] tracking-[-0.11px] text-text-muted mb-2">
          {showAnswer ? 'ANSWER' : 'QUESTION'}
        </p>
        <p className="text-[20px] tracking-[-0.2px] text-text leading-relaxed">
          {showAnswer ? currentCard.back : currentCard.front}
        </p>
      </Card>

      {/* Actions */}
      {!showAnswer ? (
        <Button className="w-full" onClick={() => setShowAnswer(true)}>
          Show Answer
        </Button>
      ) : (
        <div className="space-y-2">
          <p className="text-[11px] tracking-[-0.11px] text-text-dim text-center">How well did you know this?</p>
          <div className="grid grid-cols-3 gap-2">
            {([1, 2, 3, 4, 5] as Rating[]).map((r) => (
              <Button
                key={r}
                variant={r >= 4 ? 'default' : 'secondary'}
                size="sm"
                onClick={() => handleRate(r)}
              >
                {RATING_LABELS[r]}
              </Button>
            ))}
          </div>
        </div>
      )}
    </main>
  )
}
