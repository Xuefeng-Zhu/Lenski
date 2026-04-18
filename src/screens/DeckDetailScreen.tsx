import { useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router'
import { Card, Button, Badge, Textarea, ScreenHeader, useDrawerHeader } from 'even-toolkit/web'
import { useFlashcards } from '../contexts/FlashcardContext'

export function DeckDetailScreen() {
  const { deckId } = useParams<{ deckId: string }>()
  const navigate = useNavigate()
  const { decks, cards, updateCard, deleteCard, getDeckStats } = useFlashcards()

  const deck = decks.find((d) => d.id === deckId)
  const deckCards = useMemo(
    () => cards.filter((c) => c.deckId === deckId),
    [cards, deckId],
  )
  const stats = deckId ? getDeckStats(deckId) : null

  // Editing state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editFront, setEditFront] = useState('')
  const [editBack, setEditBack] = useState('')

  useDrawerHeader({ title: deck?.name ?? 'Deck', backTo: '/decks' })

  if (!deck) {
    return (
      <main className="px-3 pt-4 pb-8">
        <Card className="p-4 text-center">
          <p className="text-[13px] tracking-[-0.13px] text-text-dim">Deck not found.</p>
          <Button className="mt-3" onClick={() => navigate('/decks')}>Back to Decks</Button>
        </Card>
      </main>
    )
  }

  function startEdit(cardId: string, front: string, back: string) {
    setEditingId(cardId)
    setEditFront(front)
    setEditBack(back)
  }

  function cancelEdit() {
    setEditingId(null)
    setEditFront('')
    setEditBack('')
  }

  function saveEdit() {
    if (!editingId) return
    const f = editFront.trim()
    const b = editBack.trim()
    if (!f || !b) return
    updateCard(editingId, f, b)
    cancelEdit()
  }

  function formatNextReview(nextReview: number, lastReview: number): string {
    if (lastReview === 0) return 'New'
    const now = Date.now()
    if (nextReview <= now) return 'Due now'
    const days = Math.ceil((nextReview - now) / (24 * 60 * 60 * 1000))
    if (days === 1) return 'Due tomorrow'
    return `Due in ${days} days`
  }

  return (
    <main className="px-3 pt-4 pb-8 space-y-3">
      <ScreenHeader
        title={deck.name}
        subtitle={`${stats?.total ?? 0} cards`}
      />

      {/* Stats */}
      {stats && (
        <Card className="p-4">
          <div className="flex items-center justify-around text-center">
            <div>
              <p className="text-[20px] tracking-[-0.2px] text-text">{stats.new}</p>
              <p className="text-[11px] tracking-[-0.11px] text-text-dim">New</p>
            </div>
            <div>
              <p className="text-[20px] tracking-[-0.2px] text-accent">{stats.due}</p>
              <p className="text-[11px] tracking-[-0.11px] text-text-dim">Due</p>
            </div>
            <div>
              <p className="text-[20px] tracking-[-0.2px] text-positive">{stats.learned}</p>
              <p className="text-[11px] tracking-[-0.11px] text-text-dim">Learned</p>
            </div>
          </div>
        </Card>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        {stats && stats.due > 0 && (
          <Button className="flex-1" onClick={() => navigate('/')}>
            Study ({stats.due})
          </Button>
        )}
        <Button className="flex-1" variant="secondary" onClick={() => navigate(`/add?deck=${deck.id}`)}>
          Add Card
        </Button>
      </div>

      {/* Card list */}
      <div className="space-y-2">
        {deckCards.map((card) => (
          <Card key={card.id} className="p-4 space-y-2">
            {editingId === card.id ? (
              /* ── Edit mode ── */
              <>
                <div className="space-y-1.5">
                  <label className="text-[11px] tracking-[-0.11px] text-text-dim block">Front</label>
                  <Textarea
                    value={editFront}
                    onChange={(e) => setEditFront(e.target.value)}
                    rows={2}
                    autoFocus
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] tracking-[-0.11px] text-text-dim block">Back</label>
                  <Textarea
                    value={editBack}
                    onChange={(e) => setEditBack(e.target.value)}
                    rows={2}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" onClick={saveEdit} disabled={!editFront.trim() || !editBack.trim()}>
                    Save
                  </Button>
                  <Button size="sm" variant="ghost" onClick={cancelEdit}>
                    Cancel
                  </Button>
                </div>
              </>
            ) : (
              /* ── View mode ── */
              <>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] tracking-[-0.15px] text-text truncate">{card.front}</p>
                    <p className="text-[13px] tracking-[-0.13px] text-text-dim truncate">{card.back}</p>
                  </div>
                  <Badge variant="neutral" className="shrink-0">
                    {formatNextReview(card.nextReview, card.lastReview)}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 text-[11px] tracking-[-0.11px] text-text-muted">
                  <span>Ease: {card.easeFactor.toFixed(1)}</span>
                  <span>·</span>
                  <span>Interval: {card.interval}d</span>
                  <span>·</span>
                  <span>Reps: {card.repetition}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="secondary" onClick={() => startEdit(card.id, card.front, card.back)}>
                    Edit
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => deleteCard(card.id)}>
                    Delete
                  </Button>
                </div>
              </>
            )}
          </Card>
        ))}
      </div>

      {deckCards.length === 0 && (
        <Card className="p-4 text-center">
          <p className="text-[13px] tracking-[-0.13px] text-text-dim">
            No cards in this deck yet.
          </p>
        </Card>
      )}
    </main>
  )
}
