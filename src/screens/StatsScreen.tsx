import { useMemo } from 'react'
import { Card, Badge, ScreenHeader, useDrawerHeader } from 'even-toolkit/web'
import { BarChart, LineChart, PieChart, StatCard } from 'even-toolkit/web/chart'
import { useFlashcards } from '../contexts/FlashcardContext'
import { RATING_LABELS, type Rating } from '../types'

function toDateKey(ts: number): string {
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function shortDate(dateKey: string): string {
  const [, m, d] = dateKey.split('-')
  return `${Number(m)}/${Number(d)}`
}

export function StatsScreen() {
  const { cards, decks, reviewLogs, getTotalDue } = useFlashcards()

  useDrawerHeader({})

  const totalDue = getTotalDue()
  const todayKey = toDateKey(Date.now())

  // ── Aggregate stats ──
  const stats = useMemo(() => {
    const todayReviews = reviewLogs.filter((l) => toDateKey(l.timestamp) === todayKey)
    const todayCorrect = todayReviews.filter((l) => l.rating >= 3).length

    // Streak: consecutive days with at least 1 review
    const daySet = new Set(reviewLogs.map((l) => toDateKey(l.timestamp)))
    let streak = 0
    const d = new Date()
    // Check today first; if no reviews today, start from yesterday
    if (!daySet.has(toDateKey(d.getTime()))) {
      d.setDate(d.getDate() - 1)
    }
    while (daySet.has(toDateKey(d.getTime()))) {
      streak++
      d.setDate(d.getDate() - 1)
    }

    // Average per day (last 30 days)
    const thirtyDaysAgo = Date.now() - 30 * 86400000
    const recentLogs = reviewLogs.filter((l) => l.timestamp >= thirtyDaysAgo)
    const recentDays = new Set(recentLogs.map((l) => toDateKey(l.timestamp))).size
    const avgPerDay = recentDays > 0 ? Math.round(recentLogs.length / recentDays) : 0

    return {
      totalReviews: reviewLogs.length,
      todayReviews: todayReviews.length,
      todayCorrect,
      todayAccuracy: todayReviews.length > 0 ? Math.round((todayCorrect / todayReviews.length) * 100) : 0,
      streak,
      avgPerDay,
    }
  }, [reviewLogs, todayKey])

  // ── Reviews per day (last 14 days) for line chart ──
  const dailyData = useMemo(() => {
    const days: { key: string; count: number }[] = []
    for (let i = 13; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const key = toDateKey(d.getTime())
      const count = reviewLogs.filter((l) => toDateKey(l.timestamp) === key).length
      days.push({ key, count })
    }
    return days
  }, [reviewLogs])

  const lineChartData = dailyData.map((d, i) => ({
    x: i,
    y: d.count,
    label: shortDate(d.key),
  }))

  // ── Rating distribution (pie chart) ──
  const ratingDist = useMemo(() => {
    const counts = new Map<Rating, number>()
    for (const log of reviewLogs) {
      counts.set(log.rating, (counts.get(log.rating) ?? 0) + 1)
    }
    const colors: Record<number, string> = {
      0: '#ef4444', 1: '#f97316', 2: '#eab308',
      3: '#22c55e', 4: '#06b6d4', 5: '#6366f1',
    }
    return ([1, 2, 3, 4, 5] as Rating[])
      .filter((r) => (counts.get(r) ?? 0) > 0)
      .map((r) => ({
        label: RATING_LABELS[r],
        value: counts.get(r) ?? 0,
        color: colors[r],
      }))
  }, [reviewLogs])

  // ── Per-deck breakdown (bar chart) ──
  const deckBreakdown = useMemo(() => {
    const counts = new Map<string, number>()
    for (const log of reviewLogs) {
      counts.set(log.deckId, (counts.get(log.deckId) ?? 0) + 1)
    }
    return decks
      .map((deck) => ({
        label: deck.name.length > 12 ? deck.name.slice(0, 12) + '…' : deck.name,
        value: counts.get(deck.id) ?? 0,
        color: deck.color,
      }))
      .filter((d) => d.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 8)
  }, [reviewLogs, decks])

  // ── Sparkline for stat cards (last 14 days) ──
  const sparkline = dailyData.map((d) => d.count)

  // ── Card maturity distribution ──
  const maturity = useMemo(() => {
    let newCount = 0
    let young = 0   // interval < 21 days
    let mature = 0  // interval >= 21 days
    for (const card of cards) {
      if (card.lastReview === 0) newCount++
      else if (card.interval < 21) young++
      else mature++
    }
    const data = []
    if (newCount > 0) data.push({ label: 'New', value: newCount, color: '#94a3b8' })
    if (young > 0) data.push({ label: 'Young', value: young, color: '#06b6d4' })
    if (mature > 0) data.push({ label: 'Mature', value: mature, color: '#22c55e' })
    return data
  }, [cards])

  const hasReviews = reviewLogs.length > 0

  return (
    <main className="px-3 pt-4 pb-8 space-y-3">
      <ScreenHeader
        title="Stats"
        subtitle={hasReviews
          ? `${reviewLogs.length} total reviews`
          : 'Start studying to see your stats'}
      />

      {/* Today summary */}
      <div className="grid grid-cols-2 gap-2">
        <StatCard
          label="Today"
          value={stats.todayReviews}
          change={stats.todayAccuracy > 0 ? `${stats.todayAccuracy}% correct` : undefined}
          trend={stats.todayAccuracy >= 80 ? 'up' : stats.todayAccuracy >= 50 ? 'neutral' : 'down'}
          sparklineData={sparkline}
        />
        <StatCard
          label="Due"
          value={totalDue}
          change={totalDue === 0 ? 'All caught up' : undefined}
          trend={totalDue === 0 ? 'up' : 'neutral'}
        />
        <StatCard
          label="Streak"
          value={`${stats.streak}d`}
          change={stats.streak > 0 ? 'Keep it up' : 'Study today'}
          trend={stats.streak > 0 ? 'up' : 'down'}
        />
        <StatCard
          label="Avg/day"
          value={stats.avgPerDay}
          change="Last 30 days"
          trend="neutral"
        />
      </div>

      {/* Daily reviews chart */}
      {hasReviews && (
        <Card className="p-4 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[15px] tracking-[-0.15px] text-text">Daily Reviews</p>
            <Badge variant="neutral">14 days</Badge>
          </div>
          <LineChart
            data={lineChartData}
            height={160}
            color="var(--color-accent)"
            showGrid
            showLabels
            showArea
            animated
          />
        </Card>
      )}

      {/* Rating distribution */}
      {ratingDist.length > 0 && (
        <Card className="p-4 space-y-2">
          <p className="text-[15px] tracking-[-0.15px] text-text">Rating Distribution</p>
          <div className="flex items-center justify-center">
            <PieChart
              data={ratingDist}
              size={180}
              donut
              centerLabel={`${reviewLogs.length}`}
            />
          </div>
          <div className="flex flex-wrap gap-2 justify-center">
            {ratingDist.map((d) => (
              <div key={d.label} className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} />
                <span className="text-[11px] tracking-[-0.11px] text-text-dim">
                  {d.label}: {d.value}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Per-deck breakdown */}
      {deckBreakdown.length > 0 && (
        <Card className="p-4 space-y-2">
          <p className="text-[15px] tracking-[-0.15px] text-text">Reviews by Deck</p>
          <BarChart
            data={deckBreakdown}
            height={160}
            horizontal
            showLabels
          />
        </Card>
      )}

      {/* Card maturity */}
      {maturity.length > 0 && (
        <Card className="p-4 space-y-2">
          <p className="text-[15px] tracking-[-0.15px] text-text">Card Maturity</p>
          <div className="flex items-center justify-center">
            <PieChart
              data={maturity}
              size={180}
              donut
              centerLabel={`${cards.length}`}
            />
          </div>
          <div className="flex flex-wrap gap-2 justify-center">
            {maturity.map((d) => (
              <div key={d.label} className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} />
                <span className="text-[11px] tracking-[-0.11px] text-text-dim">
                  {d.label}: {d.value}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Empty state */}
      {!hasReviews && (
        <Card className="p-4 text-center">
          <p className="text-[13px] tracking-[-0.13px] text-text-dim">
            Review some cards and your study stats will appear here.
          </p>
        </Card>
      )}
    </main>
  )
}
