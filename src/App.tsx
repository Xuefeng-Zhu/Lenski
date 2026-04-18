import { Routes, Route } from 'react-router'
import { Shell } from './layouts/shell'
import { FlashcardProvider } from './contexts/FlashcardContext'
import { StudyScreen } from './screens/StudyScreen'
import { DecksScreen } from './screens/DecksScreen'
import { DeckDetailScreen } from './screens/DeckDetailScreen'
import { AddCardScreen } from './screens/AddCardScreen'
import { Settings } from './screens/Settings'
import { ImportScreen } from './screens/ImportScreen'
import { AppGlasses } from './glass/AppGlasses'

export function App() {
  return (
    <FlashcardProvider>
      <Routes>
        <Route element={<Shell />}>
          <Route path="/" element={<StudyScreen />} />
          <Route path="/decks" element={<DecksScreen />} />
          <Route path="/deck/:deckId" element={<DeckDetailScreen />} />
          <Route path="/add" element={<AddCardScreen />} />
          <Route path="/import" element={<ImportScreen />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
      </Routes>
      <AppGlasses />
    </FlashcardProvider>
  )
}
