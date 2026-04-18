import { useMemo, useState, useCallback, useRef, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router'
import { Card, Button, Badge, Textarea, ScreenHeader, useDrawerHeader } from 'even-toolkit/web'
import { SearchBar } from 'even-toolkit/web/search-bar'
import { CategoryFilter } from 'even-toolkit/web/category-filter'
import { useFlashcards } from '../contexts/FlashcardContext'
import type { Flashcard } from '../types'

type StatusFilter = 'All' | 'Due' | 'New' | 'Learned'
const STATUS_FILTERS: StatusFilter[] = ['All', 'Due', 'New', 'Learned']
const PAGE_SIZE = 40

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

  // Search & filter
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('All')
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)

  // Editing state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editFront, setEditFront] = useState('')
  const [editBack, setEditBack] = useState('')

  // Sentinel ref for infinite scroll
  const sentinelRef = useRef<HTMLDivElement>(null)

  useDrawerHeader({ title: deck?.name ?? 'Deck', backTo: '/decks' })

  // Filtered cards
  const filteredCards = useMemo(() => {
    const now = Date.now()
    let result = deckCards

    // Status filter
    if (statusFilter === 'Due') {
      result = result.filter((c) => c.nextReview <= now)
    } else if (statusFilter === 'New') {
      result = result.filter((c) => c.lastReview === 0)
    } else if (statusFilter === 'Learned') {
      result = result.filter((c) => c.lastReview > 0 && c.nextReview > now)
    }

    // Text search
    if (query.trim()) {
      const q = query.trim().toLowerCase()
      result = result.filter(
        (c) => c.front.toLowerCase().includes(q) || c.back.toLowerCase().includes(q),
      )
    }

    return result
  }, [deckCards, query, statusFilter])

  // Reset visible count when filters change
  useEffect(() => {
    setVisibleCount(PAGE_SIZE)
  }, [query, statusFilter])

  // Infinite scroll via IntersectionObserver
  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return
    if (visibleCount >= filteredCards.length) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisibleCount((prev) => Math.min(prev + PAGE_SIZE, filteredCards.length))
        }
      },
      { rootMargin: '200px' },
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [visibleCount, filteredCards.length])

  const visibleCards = filteredCards.slice(0, visibleCount)

  const startEdit = useCallback((cardId: string, front: string, back: string) => {
    setEditingId(cardId)
    setEditFront(front)
    setEditBack(back)
  }, [])

  const cancelEdit = useCallback(() => {
    setEditingId(null)
    setEditFront('')
    setEditBack('')
  }, [])

  const saveEdit = useCallback(() => {
    if (!editingId) return
    const f = editFront.trim()
    const b = editBack.trim()
    if (!f || !b) return
    updateCard(editingId, f, b)
    setEditingId(null)
    setEditFront('')
    setEditBack('')
  }, [editingId, editFront, editBack, updateCard])

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

      {/* Search & filter */}
      {deckCards.length > 0 && (
        <div className="space-y-2">
          <SearchBar
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search cards..."
          />
          <CategoryFilter
            categories={STATUS_FILTERS}
            selected={statusFilter}
            onSelect={(s) => setStatusFilter(s as StatusFilter)}
          />
        </div>
      )}

      {/* Result count */}
      {(query.trim() || statusFilter !== 'All') && (
        <p className="text-[11px] tracking-[-0.11px] text-text-dim">
          {filteredCards.length} card{filteredCards.length !== 1 ? 's' : ''} found
          {query.trim() && ` for "${query.trim()}"`}
        </p>
      )}

      {/* Card list */}
      <div className="space-y-2">
        {visibleCards.map((card) => (
          <CardRow
            key={card.id}
            card={card}
            isEditing={editingId === card.id}
            editFront={editFront}
            editBack={editBack}
            onEditFrontChange={setEditFront}
            onEditBackChange={setEditBack}
            onStartEdit={startEdit}
            onSaveEdit={saveEdit}
            onCancelEdit={cancelEdit}
            onDelete={deleteCard}
          />
        ))}

        {/* Infinite scroll sentinel */}
        {visibleCount < filteredCards.length && (
          <div ref={sentinelRef} className="py-4 text-center">
            <p className="text-[11px] tracking-[-0.11px] text-text-muted">
              Showing {visibleCount} of {filteredCards.length}...
            </p>
          </div>
        )}
      </div>

      {filteredCards.length === 0 && deckCards.length > 0 && (
        <Card className="p-4 text-center">
          <p className="text-[13px] tracking-[-0.13px] text-text-dim">
            No cards match your search.
          </p>
          <Button
            className="mt-2"
            size="sm"
            variant="ghost"
            onClick={() => { setQuery(''); setStatusFilter('All') }}
          >
            Clear filters
          </Button>
        </Card>
      )}

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

// ── Card row component (avoids re-rendering the entire list on edit state changes) ──

interface CardRowProps {
  card: Flashcard
  isEditing: boolean
  editFront: string
  editBack: string
  onEditFrontChange: (v: string) => void
  onEditBackChange: (v: string) => void
  onStartEdit: (id: string, front: string, back: string) => void
  onSaveEdit: () => void
  onCancelEdit: () => void
  onDelete: (id: string) => void
}

function CardRow({
  card, isEditing, editFront, editBack,
  onEditFrontChange, onEditBackChange,
  onStartEdit, onSaveEdit, onCancelEdit, onDelete,
}: CardRowProps) {
  return (
    <Card className="p-4 space-y-2">
      {isEditing ? (
        <>
          <div className="space-y-1.5">
            <label className="text-[11px] tracking-[-0.11px] text-text-dim block">Front</label>
            <Textarea
              value={editFront}
              onChange={(e) => onEditFrontChange(e.target.value)}
              rows={2}
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] tracking-[-0.11px] text-text-dim block">Back</label>
            <Textarea
              value={editBack}
              onChange={(e) => onEditBackChange(e.target.value)}
              rows={2}
            />
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={onSaveEdit} disabled={!editFront.trim() || !editBack.trim()}>
              Save
            </Button>
            <Button size="sm" variant="ghost" onClick={onCancelEdit}>
              Cancel
            </Button>
          </div>
        </>
      ) : (
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
            <Button size="sm" variant="secondary" onClick={() => onStartEdit(card.id, card.front, card.back)}>
              Edit
            </Button>
            <Button size="sm" variant="ghost" onClick={() => onDelete(card.id)}>
              Delete
            </Button>
          </div>
        </>
      )}
    </Card>
  )
}

function formatNextReview(nextReview: number, lastReview: number): string {
  if (lastReview === 0) return 'New'
  const now = Date.now()
  if (nextReview <= now) return 'Due now'
  const days = Math.ceil((nextReview - now) / (24 * 60 * 60 * 1000))
  if (days === 1) return 'Due tomorrow'
  return `Due in ${days} days`
}
