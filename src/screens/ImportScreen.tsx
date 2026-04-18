import { useState, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router'
import { Card, Button, Badge, ScreenHeader, useDrawerHeader } from 'even-toolkit/web'
import { useFlashcards } from '../contexts/FlashcardContext'
import { importApkg, type ApkgImportResult } from '../import/apkg'

type ImportState =
  | { step: 'idle' }
  | { step: 'loading'; fileName: string }
  | { step: 'preview'; fileName: string; results: ApkgImportResult[] }
  | { step: 'done'; imported: number; deckNames: string[] }
  | { step: 'error'; message: string }

export function ImportScreen() {
  const navigate = useNavigate()
  const { addDeck, addCard, decks } = useFlashcards()
  const [state, setState] = useState<ImportState>({ step: 'idle' })
  const fileInputRef = useRef<HTMLInputElement>(null)

  useDrawerHeader({ title: 'Import', backTo: '/decks' })

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.name.endsWith('.apkg')) {
      setState({ step: 'error', message: 'Please select an .apkg file (Anki deck export).' })
      return
    }

    setState({ step: 'loading', fileName: file.name })

    try {
      const results = await importApkg(file)

      if (results.length === 0) {
        setState({ step: 'error', message: 'No cards found in the APKG file.' })
        return
      }

      setState({ step: 'preview', fileName: file.name, results })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to parse APKG file.'
      setState({ step: 'error', message })
    }
  }, [])

  const handleImport = useCallback(() => {
    if (state.step !== 'preview') return

    const deckNames: string[] = []
    let totalCards = 0

    for (const result of state.results) {
      // Check if a deck with the same name already exists
      const existingDeck = decks.find((d) => d.name === result.deck.name)
      const targetDeckId = existingDeck?.id ?? addDeck(result.deck.name).id

      deckNames.push(result.deck.name)

      for (const card of result.cards) {
        addCard(targetDeckId, card.front, card.back)
        totalCards++
      }
    }

    setState({ step: 'done', imported: totalCards, deckNames })
  }, [state, decks, addDeck, addCard])

  const handleReset = useCallback(() => {
    setState({ step: 'idle' })
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [])

  return (
    <main className="px-3 pt-4 pb-8 space-y-3">
      <ScreenHeader
        title="Import APKG"
        subtitle="Import flashcards from Anki"
      />

      {/* File picker — always visible in idle/error state */}
      {(state.step === 'idle' || state.step === 'error') && (
        <Card className="p-4 space-y-3">
          <p className="text-[13px] tracking-[-0.13px] text-text-dim">
            Select an .apkg file exported from Anki. The importer reads the first
            two fields of each note as the front and back of a flashcard.
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".apkg"
            onChange={handleFileSelect}
            className="block w-full text-[13px] text-text-dim
              file:mr-3 file:py-2 file:px-4
              file:rounded-[6px] file:border-0
              file:text-[13px] file:font-medium
              file:bg-surface file:text-text
              hover:file:bg-surface-light
              cursor-pointer"
          />
          {state.step === 'error' && (
            <div className="rounded-[6px] bg-negative-alpha p-3">
              <p className="text-[13px] tracking-[-0.13px] text-negative">{state.message}</p>
            </div>
          )}
        </Card>
      )}

      {/* Loading */}
      {state.step === 'loading' && (
        <Card className="p-4 space-y-3 text-center">
          <p className="text-[15px] tracking-[-0.15px] text-text">Parsing {state.fileName}...</p>
          <p className="text-[13px] tracking-[-0.13px] text-text-dim">
            Loading SQLite database and extracting cards.
          </p>
        </Card>
      )}

      {/* Preview */}
      {state.step === 'preview' && (
        <>
          <Card className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[15px] tracking-[-0.15px] text-text">Ready to Import</p>
              <Badge variant="accent">
                {state.results.reduce((sum, r) => sum + r.cards.length, 0)} cards
              </Badge>
            </div>
            <p className="text-[11px] tracking-[-0.11px] text-text-dim">{state.fileName}</p>
          </Card>

          {/* Deck breakdown */}
          <div className="space-y-2">
            {state.results.map((result, i) => {
              const existing = decks.find((d) => d.name === result.deck.name)
              return (
                <Card key={i} className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: result.deck.color }}
                      />
                      <span className="text-[15px] tracking-[-0.15px] text-text">
                        {result.deck.name}
                      </span>
                    </div>
                    <Badge variant="neutral">{result.cards.length} cards</Badge>
                  </div>

                  {existing && (
                    <p className="text-[11px] tracking-[-0.11px] text-accent">
                      Will merge into existing deck "{existing.name}"
                    </p>
                  )}

                  {result.skipped > 0 && (
                    <p className="text-[11px] tracking-[-0.11px] text-text-muted">
                      {result.skipped} cards skipped (empty front)
                    </p>
                  )}

                  {/* Sample cards */}
                  <div className="space-y-1">
                    <p className="text-[11px] tracking-[-0.11px] text-text-dim">Sample cards:</p>
                    {result.cards.slice(0, 3).map((card, j) => (
                      <div key={j} className="rounded-[6px] bg-surface p-2">
                        <p className="text-[13px] tracking-[-0.13px] text-text truncate">
                          Q: {card.front}
                        </p>
                        <p className="text-[11px] tracking-[-0.11px] text-text-dim truncate">
                          A: {card.back}
                        </p>
                      </div>
                    ))}
                    {result.cards.length > 3 && (
                      <p className="text-[11px] tracking-[-0.11px] text-text-muted">
                        ...and {result.cards.length - 3} more
                      </p>
                    )}
                  </div>
                </Card>
              )
            })}
          </div>

          {/* Import actions */}
          <div className="flex gap-2">
            <Button className="flex-1" onClick={handleImport}>
              Import All
            </Button>
            <Button className="flex-1" variant="secondary" onClick={handleReset}>
              Cancel
            </Button>
          </div>
        </>
      )}

      {/* Done */}
      {state.step === 'done' && (
        <Card className="p-4 space-y-3 text-center">
          <p className="text-[40px]">✅</p>
          <p className="text-[15px] tracking-[-0.15px] text-text">
            Imported {state.imported} cards
          </p>
          <p className="text-[13px] tracking-[-0.13px] text-text-dim">
            {state.deckNames.length === 1
              ? `Into deck "${state.deckNames[0]}"`
              : `Into ${state.deckNames.length} decks: ${state.deckNames.join(', ')}`}
          </p>
          <div className="flex gap-2 justify-center">
            <Button onClick={() => navigate('/')}>Study Now</Button>
            <Button variant="secondary" onClick={() => navigate('/decks')}>View Decks</Button>
            <Button variant="ghost" onClick={handleReset}>Import More</Button>
          </div>
        </Card>
      )}
    </main>
  )
}
