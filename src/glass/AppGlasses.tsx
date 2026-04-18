import { useCallback, useMemo, useRef, useState } from 'react'
import { useNavigate, useLocation } from 'react-router'
import { useGlasses } from 'even-toolkit/useGlasses'
import { useFlashPhase } from 'even-toolkit/useFlashPhase'
import { createScreenMapper, getHomeTiles } from 'even-toolkit/glass-router'
import { appSplash } from './splash'
import { toDisplayData, onGlassAction, type AppSnapshot } from './selectors'
import type { AppActions, GlassMode, StudyPhase } from './shared'
import { GLASS_RATINGS } from './shared'
import type { Rating } from '../types'
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
  const [phase, setPhase] = useState<StudyPhase>('front')
  const [ratingIndex, setRatingIndex] = useState(1) // default to Good
  const [cardIndex, setCardIndex] = useState(0)

  // Session stats
  const sessionRef = useRef({ total: 0, easy: 0, good: 0, hard: 0 })

  const dueCards = getDueCards(selectedDeckId || undefined)
  const initialCountRef = useRef(0)
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

  // Track phase in a ref for callbacks
  const phaseRef = useRef<StudyPhase>(phase)
  phaseRef.current = phase

  /** Record a rating in session stats and call reviewCard */
  const rateAndTrack = useCallback((cardId: string, rating: number) => {
    reviewCard(cardId, rating as Rating)
    sessionRef.current.total++
    if (rating === 5) sessionRef.current.easy++
    else if (rating === 4) sessionRef.current.good++
    else sessionRef.current.hard++
  }, [reviewCard])

  const snapshot: AppSnapshot = {
    mode,
    deckOptions,
    selectedDeckId,
    front: currentCard?.front ?? '',
    back: currentCard?.back ?? '',
    phase,
    ratingIndex,
    remaining: mode === 'study' ? Math.max(0, dueCards.length - cardIndex) : 0,
    totalCards: initialCountRef.current,
    deckName,
    cardId: currentCard?.id ?? '',
    sessionStats: { ...sessionRef.current },
    flashPhase,
  }
  snapshotRef.current = snapshot

  const getSnapshot = useCallback(() => snapshotRef.current!, [snapshotRef])

  // ── Study actions ──

  const handleFlipToBack = useCallback(() => {
    setPhase('back')
  }, [])

  const handleFlipToFront = useCallback(() => {
    setPhase('front')
  }, [])

  const handleEnterRating = useCallback(() => {
    setRatingIndex(0) // default to Hard — user needed to flip
    setPhase('rating')
  }, [])

  const handleCycleRating = useCallback(() => {
    setRatingIndex((prev) => (prev + 1) % GLASS_RATINGS.length)
  }, [])

  const handleConfirmRating = useCallback((direction: 'next' | 'prev') => {
    if (currentCard) {
      rateAndTrack(currentCard.id, GLASS_RATINGS[ratingIndex])
    }
    // Move to next/prev card, reset to front
    setPhase('front')
    setRatingIndex(0)
    if (direction === 'next') {
      setCardIndex((prev) => Math.min(prev + 1, dueCards.length - 1))
    } else {
      setCardIndex((prev) => Math.max(prev - 1, 0))
    }
  }, [currentCard, rateAndTrack, ratingIndex, dueCards.length])

  // Browse from front — user knew it, rate Easy
  const handleNextCard = useCallback(() => {
    if (phaseRef.current === 'front' && currentCard) {
      rateAndTrack(currentCard.id, 5) // Easy — knew without flipping
    } else if (phaseRef.current === 'back' && currentCard) {
      rateAndTrack(currentCard.id, 2) // Hard — needed to see answer
    }
    setPhase('front')
    setRatingIndex(0)
    setCardIndex((prev) => Math.min(prev + 1, dueCards.length - 1))
  }, [currentCard, rateAndTrack, dueCards.length])

  const handlePrevCard = useCallback(() => {
    if (phaseRef.current === 'front' && currentCard) {
      rateAndTrack(currentCard.id, 5) // Easy
    } else if (phaseRef.current === 'back' && currentCard) {
      rateAndTrack(currentCard.id, 2) // Hard
    }
    setPhase('front')
    setRatingIndex(0)
    setCardIndex((prev) => Math.max(prev - 1, 0))
  }, [currentCard, rateAndTrack])

  // ── Deck actions ──

  const handleSelectDeck = useCallback((deckId: string) => {
    setSelectedDeckId(deckId)
    setCardIndex(0)
    setPhase('front')
    setRatingIndex(0)
    sessionRef.current = { total: 0, easy: 0, good: 0, hard: 0 }
    initialCountRef.current = getDueCards(deckId || undefined).length
    setMode('study')
  }, [getDueCards])

  const handleBackToPicker = useCallback(() => {
    if (currentCard) {
      if (phaseRef.current === 'front') {
        rateAndTrack(currentCard.id, 5) // Easy — didn't need to flip
      } else if (phaseRef.current === 'back') {
        rateAndTrack(currentCard.id, 2) // Hard — needed answer
      }
    }
    setMode('deckPicker')
    setSelectedDeckId('')
    setCardIndex(0)
    setPhase('front')
    setRatingIndex(0)
    sessionRef.current = { total: 0, easy: 0, good: 0, hard: 0 }
    initialCountRef.current = 0
  }, [currentCard, rateAndTrack])

  const ctxRef = useRef<AppActions>({
    navigate,
    flipToBack: handleFlipToBack,
    flipToFront: handleFlipToFront,
    enterRating: handleEnterRating,
    cycleRating: handleCycleRating,
    confirmRating: handleConfirmRating,
    prevCard: handlePrevCard,
    nextCard: handleNextCard,
    selectDeck: handleSelectDeck,
    backToPicker: handleBackToPicker,
  })
  ctxRef.current = {
    navigate,
    flipToBack: handleFlipToBack,
    flipToFront: handleFlipToFront,
    enterRating: handleEnterRating,
    cycleRating: handleCycleRating,
    confirmRating: handleConfirmRating,
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
      if (screen === 'home' && modeRef.current === 'study') return 'text'
      return screen === 'home' ? 'home' : 'text'
    },
    homeImageTiles: homeTiles,
  })

  return null
}
