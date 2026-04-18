import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Card, Button, Badge, Input, ScreenHeader, useDrawerHeader } from 'even-toolkit/web'
import { IcPlus } from 'even-toolkit/web/icons/svg-icons'
import { useFlashcards } from '../contexts/FlashcardContext'

export function DecksScreen() {
  const navigate = useNavigate()
  const { decks, addDeck, deleteDeck, getDeckStats } = useFlashcards()
  const [newDeckName, setNewDeckName] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  useDrawerHeader({
    right: (
      <Button variant="ghost" size="icon" onClick={() => setShowCreate(true)}>
        <IcPlus width={20} height={20} />
      </Button>
    ),
  })

  function handleCreate() {
    const name = newDeckName.trim()
    if (!name) return
    addDeck(name)
    setNewDeckName('')
    setShowCreate(false)
  }

  function handleDelete(id: string) {
    if (confirmDelete === id) {
      deleteDeck(id)
      setConfirmDelete(null)
    } else {
      setConfirmDelete(id)
    }
  }

  return (
    <main className="px-3 pt-4 pb-8 space-y-3">
      <ScreenHeader
        title="Decks"
        subtitle={`${decks.length} deck${decks.length !== 1 ? 's' : ''}`}
      />

      {/* Create deck */}
      {showCreate && (
        <Card className="p-4 space-y-3">
          <p className="text-[15px] tracking-[-0.15px] text-text">New Deck</p>
          <Input
            value={newDeckName}
            onChange={(e) => setNewDeckName(e.target.value)}
            placeholder="Deck name..."
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            autoFocus
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={handleCreate}>Create</Button>
            <Button size="sm" variant="ghost" onClick={() => { setShowCreate(false); setNewDeckName('') }}>
              Cancel
            </Button>
          </div>
        </Card>
      )}

      {/* Deck list */}
      <div className="space-y-2">
        {decks.map((deck) => {
          const stats = getDeckStats(deck.id)
          return (
            <Card key={deck.id} className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <button
                  className="flex items-center gap-2 text-left"
                  onClick={() => navigate(`/deck/${deck.id}`)}
                >
                  <span
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: deck.color }}
                  />
                  <span className="text-[15px] tracking-[-0.15px] text-text">{deck.name}</span>
                </button>
                <div className="flex items-center gap-2">
                  {stats.due > 0 && <Badge variant="accent">{stats.due} due</Badge>}
                  <Badge variant="neutral">{stats.total} cards</Badge>
                </div>
              </div>

              <div className="flex items-center gap-2 text-[11px] tracking-[-0.11px] text-text-dim">
                <span>{stats.new} new</span>
                <span>·</span>
                <span>{stats.learned} learned</span>
                <span>·</span>
                <span>{stats.due} due</span>
              </div>

              <div className="flex items-center gap-2">
                <Button size="sm" variant="secondary" onClick={() => navigate(`/deck/${deck.id}`)}>
                  Browse
                </Button>
                <Button size="sm" variant="secondary" onClick={() => navigate(`/add?deck=${deck.id}`)}>
                  Add Card
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleDelete(deck.id)}
                >
                  {confirmDelete === deck.id ? 'Confirm?' : 'Delete'}
                </Button>
              </div>
            </Card>
          )
        })}
      </div>

      {decks.length === 0 && !showCreate && (
        <Card className="p-4 text-center space-y-3">
          <p className="text-[13px] tracking-[-0.13px] text-text-dim">
            No decks yet. Create your first deck or import from Anki.
          </p>
          <div className="flex gap-2 justify-center">
            <Button onClick={() => setShowCreate(true)}>Create Deck</Button>
            <Button variant="secondary" onClick={() => navigate('/import')}>Import APKG</Button>
          </div>
        </Card>
      )}

      {decks.length > 0 && (
        <Card className="p-4">
          <Button className="w-full" variant="secondary" onClick={() => navigate('/import')}>
            Import from Anki (.apkg)
          </Button>
        </Card>
      )}
    </main>
  )
}
