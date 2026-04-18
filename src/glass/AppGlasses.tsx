import { useCallback, useMemo, useRef, useState } from 'react'
import { useNavigate, useLocation } from 'react-router'
import { useGlasses } from 'even-toolkit/useGlasses'
import { useFlashPhase } from 'even-toolkit/useFlashPhase'
import { createScreenMapper, getHomeTiles } from 'even-toolkit/glass-router'
import { appSplash } from './splash'
import { toDisplayData, onGlassAction, type AppSnapshot } from './selectors'
import type { AppActions, GlassMode } from './shared'
import { useFlashcards } from '../contexts/FlashcardContext'

const deriveScreen = createScreenMapper([
  { pattern: '/', screen: 'home' },
], 'home')

const homeTiles = getHomeTiles(appSplash)

export function AppGlasses() {
  const navigate = useNavigate()
  const location = useLocation()
  const { getDueCards, reviewCard, decks } = useFlashcards()
  const flashPhase = useFlashPhase(deriveScreen(location.pathname) === 'home')

  const [mode, setMode] = useState<GlassMode>('deckPicker')
  const [selectedDeckId, setSelectedDeckId] = useState('')
  const [revealed, setRevealed] = useState(false)
  const [cardIndex, setCardIndex] = useState(0)

  const dueCards = getDueCards(selectedDeckId || undefined)
  const currentCard = mode === 'study' ? (dueCards[cardIndex] ?? null) : null
  const deckName = currentCard
    ? (decks.find((d) => d.id === currentCard.deckId)?.name ?? 'Cards')
    : (selectedDeckId ? (decks.find((d) => d.id === selectedDeckId)?.name ?? 'Cards') : 'All Decks')

  const deckOptions = useMemo(() =>
    decks.map((d) => ({
      id: d.id,
      name: d.name,
      due: getDueCards(d.id).length,
    })),
    [decks, getDueCards],
  )

  const snapshotRef = useMemo(() => ({
    current: null as AppSnapshot | null,
  }), [])

  // Track whether the current card was revealed so we can auto-rate on move
  const wasRevealedRef = useRef(false)
  wasRevealedRef.current = revealed

  const snapshot: AppSnapshot = {
    mode,
    deckOptions,
    selectedDeckId,
    front: currentCard?.front ?? '',
    back: currentCard?.back ?? '',
    revealed,
    remaining: mode === 'study' ? Math.max(0, dueCards.length - cardIndex) : 0,
    deckName,
    cardId: currentCard?.id ?? '',
    flashPhase,
  }
  snapshotRef.current = snapshot

  const getSnapshot = useCallback(() => snapshotRef.current!, [snapshotRef])

  // Flip = toggle front/back
  const handleFlipCard = useCallback(() => {
    setRevealed((prev) => !prev)
  }, [])

  // Keep a ref alias so we don't need reveal() separately
  const handleReveal = handleFlipCard

  // Auto-rate the current card as "Good" (4) if it was revealed, then move
  const autoRateAndMove = useCallback((direction: 'next' | 'prev') => {
    if (wasRevealedRef.current && currentCard) {
      reviewCard(currentCard.id, 4) // auto-rate Good
    }
    setRevealed(false)
    if (direction === 'next') {
      setCardIndex((prev) => Math.min(prev + 1, dueCards.length - 1))
    } else {
      setCardIndex((prev) => Math.max(prev - 1, 0))
    }
  }, [currentCard, reviewCard, dueCards.length])

  const handleNextCard = useCallback(() => autoRateAndMove('next'), [autoRateAndMove])
  const handlePrevCard = useCallback(() => autoRateAndMove('prev'), [autoRateAndMove])

  const handleSelectDeck = useCallback((deckId: string) => {
    setSelectedDeckId(deckId)
    setCardIndex(0)
    setRevealed(false)
    setMode('study')
  }, [])

  const handleBackToPicker = useCallback(() => {
    // Auto-rate current card if revealed before leaving
    if (wasRevealedRef.current && currentCard) {
      reviewCard(currentCard.id, 4)
    }
    setMode('deckPicker')
    setSelectedDeckId('')
    setCardIndex(0)
    setRevealed(false)
  }, [currentCard, reviewCard])

  const ctxRef = useRef<AppActions>({
    navigate,
    reveal: handleReveal,
    flipCard: handleFlipCard,
    prevCard: handlePrevCard,
    nextCard: handleNextCard,
    selectDeck: handleSelectDeck,
    backToPicker: handleBackToPicker,
  })
  ctxRef.current = {
    navigate,
    reveal: handleReveal,
    flipCard: handleFlipCard,
    prevCard: handlePrevCard,
    nextCard: handleNextCard,
    selectDeck: handleSelectDeck,
    backToPicker: handleBackToPicker,
  }

  const handleGlassAction = useCallback(
    (action: Parameters<typeof onGlassAction>[0], nav: Parameters<typeof onGlassAction>[1], snap: AppSnapshot) =>
      onGlassAction(action, nav, snap, ctxRef.current),
    [],
  )

  // Track current glass mode so getPageMode can switch behavior
  const modeRef = useRef<GlassMode>(mode)
  modeRef.current = mode

  useGlasses({
    getSnapshot,
    toDisplayData,
    onGlassAction: handleGlassAction,
    deriveScreen,
    appName: 'LENSKI',
    splash: appSplash,
    getPageMode: (screen) => {
      // In study mode, use 'text' so GO_BACK reaches our handler
      // In deck picker, use 'home' so double-tap triggers the exit dialogue
      if (screen === 'home' && modeRef.current === 'study') return 'text'
      return screen === 'home' ? 'home' : 'text'
    },
    homeImageTiles: homeTiles,
  })

  return null
}
