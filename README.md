# Lenski

A spaced-repetition flashcard app for [Even Realities G2](https://www.evenrealities.com/) smart glasses. Study flashcards on your glasses with tap and swipe gestures, manage decks on your phone, and generate new decks with AI.

Built with [even-toolkit](https://www.npmjs.com/package/even-toolkit).

## Features

### Study on glasses

- **Deck picker** — scroll through decks, see due counts, tap to start
- **Three-phase review** — see question → flip to answer → rate (Hard/Good/Easy)
- **Smart defaults** — skip without flipping = Easy, skip after flipping = Hard, or enter rating mode to choose
- **Session summary** — star rating, accuracy %, and Easy/Good/Hard breakdown when done

### Phone UI

- **Study screen** — pick a deck or study all due cards with rating buttons
- **Deck management** — create, rename, delete decks; browse and edit cards
- **Search & filter** — search cards by text, filter by status (All/Due/New/Learned)
- **Stats & reports** — daily review chart, rating distribution, streak tracking, card maturity breakdown
- **Import APKG** — import Anki decks (.apkg files) with smart field mapping
- **AI generate** — describe a topic and generate a flashcard deck with AI (Groq/OpenAI-compatible)
- **Settings** — export data, configure AI provider, clear data

### Spaced repetition

Uses the SM-2 algorithm:
- Cards start due immediately
- Correct answers increase the review interval (1d → 6d → interval × ease factor)
- Failed cards reset to 1-day interval
- Ease factor adjusts based on difficulty ratings (minimum 1.3)

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

### Test with the simulator

```bash
npx @evenrealities/evenhub-simulator@latest http://localhost:5173
```

Use keyboard shortcuts in the simulator:
- **Enter** — tap (flip card / select)
- **Arrow up/down** — scroll (browse cards / navigate menus)
- **Escape** — double-tap (go back / exit)

## APKG import

Export a deck from Anki as `.apkg` and import it from the Decks screen or the Import APKG page. The importer:

- Supports Legacy 1 (`collection.anki2`) and Legacy 2 (`collection.anki21`) formats
- Reads note type field names to pick the best front/back mapping
- Recognizes English and Chinese field names (单词, 解释, 音标, etc.)
- Strips HTML tags and decodes entities
- Groups cards by their Anki deck

## AI deck generation

Generate flashcard decks from a text prompt using any OpenAI-compatible API.

1. Go to **Settings → AI Generation** and add your API key
2. Go to **AI Generate** from the sidebar
3. Describe what you want to study (e.g. "Top 30 Spanish travel phrases")
4. Pick the number of cards (5–50)
5. Preview and add to your collection

Default provider is [Groq](https://groq.com/) (free tier available) with `llama-3.3-70b-versatile`. You can switch to OpenAI, Together, Ollama, or any compatible endpoint by changing the base URL and model in settings.

## Build for Even Hub

```bash
npm run build
npx @evenrealities/evenhub-cli pack app.json dist
```

Upload the generated `.ehpk` file to the Even Hub.

## Tech stack

- **Framework** — React 19 + TypeScript + Vite
- **Glasses SDK** — @evenrealities/even_hub_sdk + even-toolkit
- **UI components** — even-toolkit/web (design system for G2 apps)
- **APKG import** — sql.js (SQLite WASM) + JSZip
- **Styling** — Tailwind CSS 4

## License

MIT
