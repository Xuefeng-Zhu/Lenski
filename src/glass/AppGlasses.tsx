import { useCallback, useMemo, useRef, useState } from 'react'
import { useNavigate, useLocation } from 'react-router'
import { useGlasses } from 'even-toolkit/useGlasses'
import { useFlashPhase } from 'even-toolkit/useFlashPhase'
import { createScreenMapper, getHomeTiles } from 'even-toolkit/glass-router'
import { appSplash } from './splash'
import { toDisplayData, onGlassAction, type AppSnapshot } from './selectors'
import type { AppActions } from './shared'
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

  const [revealed, setRevealed] = useState(false)
  const [cardIndex, setCardIndex] = useState(0)

  const dueCards = getDueCards()
  const currentCard = dueCards[cardIndex] ?? null
  const deckName = currentCard
    ? (decks.find((d) => d.id === currentCard.deckId)?.name ?? 'Cards')
    : ''

  const snapshotRef = useMemo(() => ({
    current: null as AppSnapshot | null,
  }), [])

  const snapshot: AppSnapshot = {
    front: currentCard?.front ?? '',
    back: currentCard?.back ?? '',
    revealed,
    remaining: dueCards.length - cardIndex,
    deckName,
    cardId: currentCard?.id ?? '',
    flashPhase,
  }
  snapshotRef.current = snapshot

  const getSnapshot = useCallback(() => snapshotRef.current!, [snapshotRef])

  const handleReveal = useCallback(() => {
    setRevealed(true)
  }, [])

  const handleRate = useCallback((rating: Rating) => {
    if (!currentCard) return
    reviewCard(currentCard.id, rating)
    setRevealed(false)
    // Move to next card (the reviewed card will drop out of dueCards)
    setCardIndex((prev) => Math.min(prev, Math.max(0, dueCards.length - 2)))
  }, [currentCard, reviewCard, dueCards.length])

  const handleNextCard = useCallback(() => {
    setRevealed(false)
    setCardIndex((prev) => Math.min(prev + 1, dueCards.length - 1))
  }, [dueCards.length])

  const ctxRef = useRef<AppActions>({ navigate, reveal: handleReveal, rate: handleRate, nextCard: handleNextCard })
  ctxRef.current = { navigate, reveal: handleReveal, rate: handleRate, nextCard: handleNextCard }

  const handleGlassAction = useCallback(
    (action: Parameters<typeof onGlassAction>[0], nav: Parameters<typeof onGlassAction>[1], snap: AppSnapshot) =>
      onGlassAction(action, nav, snap, ctxRef.current),
    [],
  )

  useGlasses({
    getSnapshot,
    toDisplayData,
    onGlassAction: handleGlassAction,
    deriveScreen,
    appName: 'LENSKI',
    splash: appSplash,
    getPageMode: (screen) => screen === 'home' ? 'home' : 'text',
    homeImageTiles: homeTiles,
  })

  return null
}
