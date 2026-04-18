import type { GlassScreen } from 'even-toolkit/glass-screen-router'
import { line, separator, glassHeader } from 'even-toolkit/types'
import type { AppSnapshot, AppActions } from '../shared'

export const homeScreen: GlassScreen<AppSnapshot, AppActions> = {
  display(snapshot) {
    if (!snapshot.front) {
      return {
        lines: [
          ...glassHeader('LENSKI'),
          line(''),
          line('No cards due!'),
          line(''),
          line('Add cards on your phone'),
          line('to start studying.'),
        ],
      }
    }

    if (!snapshot.revealed) {
      // Show question side
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

    // Show answer side with rating options
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
    if (!snapshot.front) return nav

    if (!snapshot.revealed) {
      // Any tap reveals the answer
      if (action.type === 'SELECT_HIGHLIGHTED') {
        ctx.reveal()
        return nav
      }
      return nav
    }

    // Answer is revealed — rate the card
    if (action.type === 'HIGHLIGHT_MOVE') {
      if (action.direction === 'up') {
        // Scroll up = Easy (5)
        ctx.rate(5)
        return nav
      }
      if (action.direction === 'down') {
        // Scroll down = Hard (2)
        ctx.rate(2)
        return nav
      }
    }

    if (action.type === 'SELECT_HIGHLIGHTED') {
      // Tap = Good (4)
      ctx.rate(4)
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
