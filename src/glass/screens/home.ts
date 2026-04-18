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
      // Scroll window
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

    // ── Study mode: question ──
    if (!snapshot.revealed) {
      return {
        lines: [
          ...glassHeader(`${snapshot.deckName}  (${snapshot.remaining} left)`),
          line(''),
          ...wrapText(snapshot.front, 34).map((l) => line(l)),
          line(''),
          separator(),
          line('Tap to reveal answer', 'meta'),
        ],
      }
    }

    // ── Study mode: answer revealed ──
    return {
      lines: [
        ...glassHeader(`${snapshot.deckName}  (${snapshot.remaining} left)`),
        line(''),
        ...wrapText(snapshot.back, 34).map((l) => line(l)),
        line(''),
        separator(),
        line('\u2191 Easy  Tap: Good  \u2193 Hard', 'meta'),
      ],
    }
  },

  action(action, nav, snapshot, ctx) {
    // ── Deck picker mode ──
    if (snapshot.mode === 'deckPicker') {
      const itemCount = snapshot.deckOptions.length + 1 // +1 for "All Decks"

      if (action.type === 'HIGHLIGHT_MOVE') {
        return {
          ...nav,
          highlightedIndex: moveHighlight(nav.highlightedIndex, action.direction, itemCount - 1),
        }
      }

      if (action.type === 'SELECT_HIGHLIGHTED') {
        const idx = nav.highlightedIndex
        if (idx === 0) {
          // "All Decks"
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

    // GO_BACK returns to deck picker
    if (action.type === 'GO_BACK') {
      ctx.backToPicker()
      return { ...nav, highlightedIndex: 0 }
    }

    // No cards — only back works
    if (!snapshot.front) return nav

    // Question shown — tap to reveal
    if (!snapshot.revealed) {
      if (action.type === 'SELECT_HIGHLIGHTED') {
        ctx.reveal()
        return nav
      }
      return nav
    }

    // Answer revealed — rate
    if (action.type === 'HIGHLIGHT_MOVE') {
      if (action.direction === 'up') {
        ctx.rate(5) // Easy
        return nav
      }
      if (action.direction === 'down') {
        ctx.rate(2) // Hard
        return nav
      }
    }

    if (action.type === 'SELECT_HIGHLIGHTED') {
      ctx.rate(4) // Good
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
