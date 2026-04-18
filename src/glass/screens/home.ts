import type { GlassScreen } from 'even-toolkit/glass-screen-router'
import { line, separator, glassHeader } from 'even-toolkit/types'
import { moveHighlight } from 'even-toolkit/glass-nav'
import type { AppSnapshot, AppActions } from '../shared'

export const homeScreen: GlassScreen<AppSnapshot, AppActions> = {
  display(snapshot, nav) {
    // ── Deck picker mode ──
    if (snapshot.mode === 'deckPicker') {
      const options = snapshot.deckOptions
      if (options.length === 0) {
        return {
          lines: [
            ...glassHeader('LENSKI'),
            line(''),
            line('No decks yet!'),
            line(''),
            line('Add decks on your phone.'),
          ],
        }
      }

      const totalDue = options.reduce((s, d) => s + d.due, 0)
      const items = [
        { label: 'All Decks', due: totalDue },
        ...options.map((d) => ({ label: d.name, due: d.due })),
      ]

      const maxVisible = 6
      const highlighted = nav.highlightedIndex
      let scrollTop = 0
      if (highlighted >= maxVisible) {
        scrollTop = highlighted - maxVisible + 1
      }
      const visible = items.slice(scrollTop, scrollTop + maxVisible)

      const lines = [
        ...glassHeader('LENSKI  Select Deck'),
      ]

      for (let i = 0; i < visible.length; i++) {
        const item = visible[i]
        const idx = scrollTop + i
        const isHighlighted = idx === highlighted
        const prefix = isHighlighted ? '\u25B6 ' : '  '
        const dueStr = item.due > 0 ? ` (${item.due})` : ''
        lines.push(line(`${prefix}${item.label}${dueStr}`, 'normal', isHighlighted))
      }

      if (items.length > maxVisible) {
        lines.push(separator())
        lines.push(line(`${highlighted + 1}/${items.length}`, 'meta'))
      }

      return { lines }
    }

    // ── Study mode: no cards ──
    if (!snapshot.front) {
      return {
        lines: [
          ...glassHeader('LENSKI'),
          line(''),
          line('No cards due!'),
          line(''),
          line('All caught up.'),
          separator(),
          line('Double-tap to go back', 'meta'),
        ],
      }
    }

    // ── Study mode: showing front ──
    if (!snapshot.revealed) {
      return {
        lines: [
          ...glassHeader(`${snapshot.deckName}  (${snapshot.remaining} left)`),
          line(''),
          ...wrapText(snapshot.front, 34).map((l) => line(l)),
          line(''),
          separator(),
          line('Tap: flip  \u2191\u2193 prev/next', 'meta'),
        ],
      }
    }

    // ── Study mode: showing back ──
    return {
      lines: [
        ...glassHeader(`${snapshot.deckName}  (${snapshot.remaining} left)`),
        line(''),
        ...wrapText(snapshot.back, 34).map((l) => line(l)),
        line(''),
        separator(),
        line('Tap: flip  \u2191\u2193 prev/next', 'meta'),
      ],
    }
  },

  action(action, nav, snapshot, ctx) {
    // ── Deck picker mode ──
    if (snapshot.mode === 'deckPicker') {
      const itemCount = snapshot.deckOptions.length + 1

      if (action.type === 'HIGHLIGHT_MOVE') {
        return {
          ...nav,
          highlightedIndex: moveHighlight(nav.highlightedIndex, action.direction, itemCount - 1),
        }
      }

      if (action.type === 'SELECT_HIGHLIGHTED') {
        const idx = nav.highlightedIndex
        if (idx === 0) {
          ctx.selectDeck('')
        } else {
          const deck = snapshot.deckOptions[idx - 1]
          if (deck) ctx.selectDeck(deck.id)
        }
        return { ...nav, highlightedIndex: 0 }
      }

      return nav
    }

    // ── Study mode ──

    if (action.type === 'GO_BACK') {
      ctx.backToPicker()
      return { ...nav, highlightedIndex: 0 }
    }

    if (!snapshot.front) return nav

    // Tap = flip card (toggle front/back)
    if (action.type === 'SELECT_HIGHLIGHTED') {
      ctx.flipCard()
      return nav
    }

    // Up/Down = move between cards
    if (action.type === 'HIGHLIGHT_MOVE') {
      if (action.direction === 'up') {
        ctx.prevCard()
      } else {
        ctx.nextCard()
      }
      return nav
    }

    return nav
  },
}

/** Word-wrap text to fit the G2 display width */
function wrapText(text: string, maxWidth: number): string[] {
  const lines: string[] = []
  const words = text.split(' ')
  let current = ''

  for (const word of words) {
    if (current.length + word.length + 1 > maxWidth) {
      if (current) lines.push(current)
      current = word
    } else {
      current = current ? `${current} ${word}` : word
    }
  }
  if (current) lines.push(current)
  return lines.length > 0 ? lines : ['']
}
