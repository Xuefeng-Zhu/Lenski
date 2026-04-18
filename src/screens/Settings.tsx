import { useState, useEffect } from 'react'
import { SettingsGroup, Card, Button, Input, ListItem, Divider, useDrawerHeader } from 'even-toolkit/web'
import { useFlashcards } from '../contexts/FlashcardContext'
import { loadAIConfig, saveAIConfig } from '../ai/generate'

export function Settings() {
  const { cards, decks } = useFlashcards()
  const [confirmClear, setConfirmClear] = useState(false)

  // AI config
  const [aiKey, setAiKey] = useState('')
  const [aiBaseUrl, setAiBaseUrl] = useState('')
  const [aiModel, setAiModel] = useState('')
  const [aiSaved, setAiSaved] = useState(false)

  useEffect(() => {
    const config = loadAIConfig()
    setAiKey(config.apiKey)
    setAiBaseUrl(config.baseUrl)
    setAiModel(config.model)
  }, [])

  useDrawerHeader({ title: 'Settings', backTo: '/' })

  const totalReviewed = cards.filter((c) => c.lastReview > 0).length

  function handleSaveAI() {
    saveAIConfig({ apiKey: aiKey.trim(), baseUrl: aiBaseUrl.trim(), model: aiModel.trim() })
    setAiSaved(true)
    setTimeout(() => setAiSaved(false), 2000)
  }

  function handleExport() {
    const data = JSON.stringify({ decks, cards }, null, 2)
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `lenski-export-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  function handleClearAll() {
    if (!confirmClear) {
      setConfirmClear(true)
      return
    }
    localStorage.removeItem('lenski-decks')
    localStorage.removeItem('lenski-cards')
    localStorage.removeItem('lenski-review-logs')
    window.location.reload()
  }

  return (
    <main className="px-3 pt-4 pb-8 space-y-6">
      <SettingsGroup label="AI Generation">
        <Card className="p-4 space-y-3">
          <p className="text-[11px] tracking-[-0.11px] text-text-dim">
            Configure an OpenAI-compatible API to generate flashcard decks with AI.
            Default: Groq (free tier available at groq.com).
          </p>
          <div className="space-y-1.5">
            <label className="text-[11px] tracking-[-0.11px] text-text-dim block">API Key</label>
            <Input
              type="password"
              value={aiKey}
              onChange={(e) => setAiKey(e.target.value)}
              placeholder="gsk_..."
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] tracking-[-0.11px] text-text-dim block">Base URL</label>
            <Input
              value={aiBaseUrl}
              onChange={(e) => setAiBaseUrl(e.target.value)}
              placeholder="https://api.groq.com/openai/v1"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] tracking-[-0.11px] text-text-dim block">Model</label>
            <Input
              value={aiModel}
              onChange={(e) => setAiModel(e.target.value)}
              placeholder="llama-3.3-70b-versatile"
            />
          </div>
          <Button size="sm" onClick={handleSaveAI}>
            {aiSaved ? '✓ Saved' : 'Save'}
          </Button>
        </Card>
      </SettingsGroup>

      <SettingsGroup label="Statistics">
        <Card className="p-4 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[13px] tracking-[-0.13px] text-text">Total decks</span>
            <span className="text-[13px] tracking-[-0.13px] text-text-dim">{decks.length}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[13px] tracking-[-0.13px] text-text">Total cards</span>
            <span className="text-[13px] tracking-[-0.13px] text-text-dim">{cards.length}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[13px] tracking-[-0.13px] text-text">Reviewed</span>
            <span className="text-[13px] tracking-[-0.13px] text-text-dim">{totalReviewed}</span>
          </div>
        </Card>
      </SettingsGroup>

      <SettingsGroup label="Data">
        <Card className="divide-y divide-border">
          <ListItem
            title="Export Data"
            subtitle={`Export ${decks.length} decks and ${cards.length} cards as JSON`}
            onPress={handleExport}
          />
          <div>
            <ListItem
              title={confirmClear ? 'Tap again to confirm' : 'Clear All Data'}
              subtitle="Permanently delete all decks and cards"
              onPress={handleClearAll}
            />
            {confirmClear && (
              <div className="px-4 pb-3">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full"
                  onClick={() => setConfirmClear(false)}
                >
                  Cancel
                </Button>
              </div>
            )}
          </div>
        </Card>
      </SettingsGroup>

      <SettingsGroup label="About">
        <Card className="p-4 space-y-1.5">
          <p className="text-[15px] tracking-[-0.15px] text-text">Lenski</p>
          <p className="text-[13px] tracking-[-0.13px] text-text-dim">Version 1.0.0</p>
          <Divider className="my-2" />
          <p className="text-[11px] tracking-[-0.11px] text-text-dim">
            A spaced-repetition flashcard app for Even Realities G2 smart glasses.
            Review cards on your glasses with tap and swipe gestures.
            All data is stored locally in your browser.
          </p>
        </Card>
      </SettingsGroup>
    </main>
  )
}
