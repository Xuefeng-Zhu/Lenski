import JSZip from 'jszip'
import initSqlJs, { type Database } from 'sql.js'
import type { Flashcard, Deck } from '../types'
import { DEFAULT_EASE_FACTOR, DECK_COLORS } from '../types'

export interface ApkgImportResult {
  deck: Deck
  cards: Flashcard[]
  skipped: number
  errors: string[]
}

/**
 * Strip HTML tags and decode common HTML entities.
 * Anki stores note fields as HTML.
 */
function stripHtml(html: string): string {
  // Replace <br>, <br/>, <br /> with newlines
  let text = html.replace(/<br\s*\/?>/gi, '\n')
  // Replace <div>, </div>, <p>, </p> with newlines
  text = text.replace(/<\/?(div|p)[^>]*>/gi, '\n')
  // Strip all remaining HTML tags
  text = text.replace(/<[^>]+>/g, '')
  // Decode common HTML entities
  text = text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#x27;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
  // Collapse multiple newlines
  text = text.replace(/\n{3,}/g, '\n\n')
  return text.trim()
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

/**
 * Try to find the SQLite database inside the APKG zip.
 * Handles both Legacy 2 (collection.anki21) and Legacy 1 (collection.anki2) formats.
 */
async function extractDatabase(zip: JSZip): Promise<Uint8Array> {
  // Try Legacy 2 first (most common for shared decks)
  const anki21 = zip.file('collection.anki21')
  if (anki21) {
    return new Uint8Array(await anki21.async('arraybuffer'))
  }

  // Fall back to Legacy 1
  const anki2 = zip.file('collection.anki2')
  if (anki2) {
    return new Uint8Array(await anki2.async('arraybuffer'))
  }

  throw new Error('No collection database found in APKG file. Expected collection.anki21 or collection.anki2.')
}

/**
 * Parse the note type models from the col table to understand field ordering.
 * Returns a map of model ID → array of field names in order.
 */
function parseModels(db: Database): Map<number, string[]> {
  const models = new Map<number, string[]>()

  const result = db.exec('SELECT models FROM col LIMIT 1')
  if (result.length === 0 || result[0].values.length === 0) return models

  const modelsJson = JSON.parse(result[0].values[0][0] as string)

  for (const [id, model] of Object.entries(modelsJson)) {
    const m = model as { flds: { name: string; ord: number }[] }
    const fields = m.flds
      .sort((a, b) => a.ord - b.ord)
      .map((f) => f.name)
    models.set(Number(id), fields)
  }

  return models
}

/**
 * Parse deck names from the col table.
 * Returns a map of deck ID → deck name.
 */
function parseDeckNames(db: Database): Map<number, string> {
  const deckNames = new Map<number, string>()

  const result = db.exec('SELECT decks FROM col LIMIT 1')
  if (result.length === 0 || result[0].values.length === 0) return deckNames

  const decksJson = JSON.parse(result[0].values[0][0] as string)

  for (const [id, deck] of Object.entries(decksJson)) {
    const d = deck as { name: string }
    deckNames.set(Number(id), d.name)
  }

  return deckNames
}

/**
 * Import an APKG file and return decks and cards.
 *
 * Strategy:
 * 1. Unzip the APKG
 * 2. Open the SQLite database
 * 3. Read note types (models) to understand field structure
 * 4. Read notes and split fields by 0x1f separator
 * 5. For each note, use the first field as "front" and second as "back"
 * 6. Group cards by their Anki deck
 */
export async function importApkg(file: File): Promise<ApkgImportResult[]> {
  // Load sql.js WASM
  const SQL = await initSqlJs({
    locateFile: (filename: string) => `https://sql.js.org/dist/${filename}`,
  })

  // Unzip the APKG
  const zipData = await file.arrayBuffer()
  const zip = await JSZip.loadAsync(zipData)

  // Extract and open the database
  const dbBytes = await extractDatabase(zip)
  const db = new SQL.Database(dbBytes)

  const errors: string[] = []
  const results: ApkgImportResult[] = []

  try {
    const models = parseModels(db)
    const ankiDeckNames = parseDeckNames(db)

    // Query all notes joined with their cards to get deck assignment
    // A note can produce multiple cards (e.g. Basic and Reversed),
    // but we only need one card per note for the deck assignment
    const rows = db.exec(`
      SELECT DISTINCT
        n.id as nid,
        n.mid as mid,
        n.flds as flds,
        c.did as did
      FROM notes n
      JOIN cards c ON c.nid = n.id
      GROUP BY n.id
    `)

    if (rows.length === 0 || rows[0].values.length === 0) {
      errors.push('No cards found in the APKG file.')
      return results
    }

    // Group notes by deck
    const deckGroups = new Map<number, { front: string; back: string }[]>()
    let skippedTotal = 0

    for (const row of rows[0].values) {
      const mid = row[1] as number
      const flds = row[2] as string
      const did = row[3] as number

      // Split fields by 0x1f separator
      const fields = flds.split('\x1f')

      // Get field names from the model
      const fieldNames = models.get(mid)

      let front = ''
      let back = ''

      if (fieldNames && fieldNames.length >= 2) {
        // Use the first two fields as front/back
        front = stripHtml(fields[0] ?? '')
        back = stripHtml(fields[1] ?? '')
      } else if (fields.length >= 2) {
        // Fallback: just use first two fields
        front = stripHtml(fields[0] ?? '')
        back = stripHtml(fields[1] ?? '')
      } else if (fields.length === 1) {
        // Cloze or single-field: use the field as both
        front = stripHtml(fields[0] ?? '')
        back = front
      }

      if (!front) {
        skippedTotal++
        continue
      }

      if (!deckGroups.has(did)) {
        deckGroups.set(did, [])
      }
      deckGroups.get(did)!.push({ front, back })
    }

    // Create results per deck
    let colorIndex = 0
    for (const [did, cardPairs] of deckGroups) {
      const ankiName = ankiDeckNames.get(did) ?? 'Imported Deck'
      // Strip Anki's hierarchical deck naming (e.g. "Parent::Child" → "Child")
      const deckName = ankiName.includes('::')
        ? ankiName.split('::').pop()!
        : ankiName

      const deckId = generateId()
      const deck: Deck = {
        id: deckId,
        name: deckName,
        color: DECK_COLORS[colorIndex % DECK_COLORS.length],
        createdAt: Date.now(),
      }
      colorIndex++

      const cards: Flashcard[] = cardPairs.map(({ front, back }) => ({
        id: generateId(),
        front,
        back: back || front,
        deckId,
        interval: 0,
        repetition: 0,
        easeFactor: DEFAULT_EASE_FACTOR,
        nextReview: 0,
        lastReview: 0,
      }))

      results.push({
        deck,
        cards,
        skipped: 0,
        errors: [],
      })
    }

    // Distribute skipped count to first result
    if (results.length > 0 && skippedTotal > 0) {
      results[0].skipped = skippedTotal
    }

    if (errors.length > 0 && results.length > 0) {
      results[0].errors = errors
    }
  } finally {
    db.close()
  }

  return results
}
