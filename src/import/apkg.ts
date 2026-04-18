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
 * Handles Legacy 2 (collection.anki21), Legacy 1 (collection.anki2),
 * and Latest format (collection.anki2b — not yet supported).
 */
async function extractDatabase(zip: JSZip): Promise<Uint8Array> {
  // Try Legacy 2 first (most common for shared decks)
  for (const name of ['collection.anki21', 'collection.anki2']) {
    const file = zip.file(name)
    if (file) {
      return new Uint8Array(await file.async('arraybuffer'))
    }
  }

  throw new Error(
    'No collection database found in APKG file. ' +
    'Expected collection.anki21 or collection.anki2.'
  )
}

interface ModelInfo {
  name: string
  fields: string[]
}

/**
 * Parse the note type models from the col table to understand field ordering.
 * Returns a map of model ID → model info (name + field names in order).
 */
function parseModels(db: Database): Map<number, ModelInfo> {
  const models = new Map<number, ModelInfo>()

  const result = db.exec('SELECT models FROM col LIMIT 1')
  if (result.length === 0 || result[0].values.length === 0) return models

  const modelsJson = JSON.parse(result[0].values[0][0] as string)

  for (const [id, model] of Object.entries(modelsJson)) {
    const m = model as { name: string; flds: { name: string; ord: number }[] }
    const fields = m.flds
      .sort((a, b) => a.ord - b.ord)
      .map((f) => f.name)
    models.set(Number(id), { name: m.name, fields })
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
 * Heuristic to pick the best "front" and "back" field indices from a model.
 *
 * Strategy:
 * 1. If there are fields named Front/Back (or Question/Answer), use those.
 * 2. Otherwise, use field[0] as front. For back, skip fields that look like
 *    pronunciation/audio and pick the next substantive field.
 */
function pickFrontBack(fieldNames: string[]): { frontIdx: number; backIdx: number } {
  const lower = fieldNames.map((f) => f.toLowerCase())

  // Try common naming conventions (English + Chinese + other languages)
  const frontAliases = [
    'front', 'question', 'word', 'term', 'vocabulary', 'vocab',
    '单词', '词汇', '问题', '正面', '前面',
  ]
  const backAliases = [
    'back', 'answer', 'definition', 'meaning', 'translation', 'explanation',
    '解释', '释义', '定义', '翻译', '意思', '答案', '背面', '反面',
  ]

  let frontIdx = -1
  let backIdx = -1

  for (const alias of frontAliases) {
    const idx = fieldNames.findIndex((f) => f.toLowerCase().includes(alias) || f.includes(alias))
    if (idx !== -1) { frontIdx = idx; break }
  }

  for (const alias of backAliases) {
    const idx = fieldNames.findIndex((f) => f.toLowerCase().includes(alias) || f.includes(alias))
    if (idx !== -1) { backIdx = idx; break }
  }

  // If we found both, use them
  if (frontIdx !== -1 && backIdx !== -1) return { frontIdx, backIdx }

  // Default: front is always field 0
  if (frontIdx === -1) frontIdx = 0

  // For back: skip fields that look like pronunciation, audio, or media
  const skipPatterns = [
    'audio', 'sound', 'media', 'image', 'img', 'pic', 'photo',
    'pronunciation', 'phonetic', 'ipa',
    '音标', '发音', '音频', '图片', '图像', '媒体',
  ]

  if (backIdx === -1) {
    for (let i = 1; i < fieldNames.length; i++) {
      const name = fieldNames[i]
      const nameLower = lower[i]
      const isSkippable = skipPatterns.some((p) => nameLower.includes(p) || name.includes(p))
      if (!isSkippable) {
        backIdx = i
        break
      }
    }
    // If everything was skippable, just use field 1
    if (backIdx === -1) backIdx = Math.min(1, fieldNames.length - 1)
  }

  return { frontIdx, backIdx }
}

/**
 * Import an APKG file and return decks and cards.
 *
 * Strategy:
 * 1. Unzip the APKG
 * 2. Open the SQLite database with sql.js (WASM)
 * 3. Read note types (models) to understand field structure
 * 4. Read notes and split fields by 0x1f separator
 * 5. Use heuristics to pick the best front/back fields
 * 6. Group cards by their Anki deck
 */
export async function importApkg(file: File): Promise<ApkgImportResult[]> {
  // Load sql.js WASM from the public folder
  const SQL = await initSqlJs({
    locateFile: () => new URL('/sql-wasm.wasm', window.location.origin).href,
  })

  // Unzip the APKG
  const zipData = await file.arrayBuffer()
  const zip = await JSZip.loadAsync(zipData)

  // Extract and open the database
  const dbBytes = await extractDatabase(zip)
  const db = new SQL.Database(dbBytes)

  const results: ApkgImportResult[] = []

  try {
    const models = parseModels(db)
    const ankiDeckNames = parseDeckNames(db)

    // Pre-compute front/back indices per model
    const modelFieldMap = new Map<number, { frontIdx: number; backIdx: number }>()
    for (const [mid, info] of models) {
      modelFieldMap.set(mid, pickFrontBack(info.fields))
    }

    // Query all notes joined with their cards to get deck assignment.
    // GROUP BY n.id so we get one row per note even if it has multiple cards.
    const rows = db.exec(`
      SELECT
        n.id as nid,
        n.mid as mid,
        n.flds as flds,
        c.did as did
      FROM notes n
      JOIN cards c ON c.nid = n.id
      GROUP BY n.id
    `)

    if (rows.length === 0 || rows[0].values.length === 0) {
      return [{ deck: { id: '', name: '', color: '', createdAt: 0 }, cards: [], skipped: 0, errors: ['No cards found in the APKG file.'] }]
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

      // Get the front/back indices for this model
      const mapping = modelFieldMap.get(mid) ?? { frontIdx: 0, backIdx: Math.min(1, fields.length - 1) }

      const front = stripHtml(fields[mapping.frontIdx] ?? '')
      const back = stripHtml(fields[mapping.backIdx] ?? '')

      if (!front) {
        skippedTotal++
        continue
      }

      if (!deckGroups.has(did)) {
        deckGroups.set(did, [])
      }
      deckGroups.get(did)!.push({ front, back: back || front })
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
        back,
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
  } finally {
    db.close()
  }

  return results
}
