import { DrawerShell } from 'even-toolkit/web'
import type { SideDrawerItem } from 'even-toolkit/web'

const MENU_ITEMS: SideDrawerItem[] = [
  { id: '/', label: 'Study', section: 'Flashcards' },
  { id: '/decks', label: 'Decks', section: 'Flashcards' },
  { id: '/stats', label: 'Stats', section: 'Flashcards' },
  { id: '/import', label: 'Import APKG', section: 'Flashcards' },
]

const BOTTOM_ITEMS: SideDrawerItem[] = [
  { id: '/settings', label: 'Settings', section: 'App' },
]

function getPageTitle(pathname: string): string {
  if (pathname === '/') return 'Lenski'
  if (pathname === '/decks') return 'Decks'
  if (pathname.startsWith('/deck/')) return 'Deck'
  if (pathname === '/add') return 'Add Card'
  if (pathname === '/import') return 'Import APKG'
  if (pathname === '/stats') return 'Stats'
  if (pathname === '/settings') return 'Settings'
  return 'Lenski'
}

function deriveActiveId(pathname: string): string {
  if (pathname === '/settings') return '/settings'
  if (pathname === '/decks' || pathname.startsWith('/deck/')) return '/decks'
  if (pathname === '/add') return '/decks'
  if (pathname === '/stats') return '/stats'
  if (pathname === '/import') return '/import'
  return '/'
}

export function Shell() {
  return (
    <DrawerShell
      items={MENU_ITEMS}
      bottomItems={BOTTOM_ITEMS}
      title="Lenski"
      getPageTitle={getPageTitle}
      deriveActiveId={deriveActiveId}
    />
  )
}
