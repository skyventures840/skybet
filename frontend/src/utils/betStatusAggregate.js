export function aggregateBetStatus (statuses, fallbackStatus = 'pending') {
  const normalize = (s) => {
    const t = String(s || '').trim().toLowerCase()
    if (t === 'win' || t === 'won') return 'won'
    if (t === 'loss' || t === 'lost') return 'lost'
    if (t === 'void') return 'void'
    if (t === 'pending') return 'pending'
    return t
  }
  const listRaw = Array.isArray(statuses) ? statuses : []
  const list = listRaw.filter(Boolean).map(normalize)
  const fb = normalize(fallbackStatus || 'pending')
  if (list.length === 0) return fb
  const hasPending = list.some(s => s === 'pending')
  const isFinalFallback = fb === 'won' || fb === 'lost' || fb === 'void'
  const nonPending = list.filter(s => s !== 'pending')
  const allNonPendingWon = nonPending.every(s => s === 'won')
  if (hasPending && isFinalFallback && allNonPendingWon) return fb
  if (list.some(s => s === 'pending')) return 'pending'
  if (list.every(s => s === 'won')) return 'won'
  if (list.some(s => s === 'lost')) return 'lost'
  if (list.some(s => s === 'void')) return 'void'
  return fb
}

export function aggregateBetStatusWinLossOnly (statuses, fallbackStatus = 'pending') {
  const normalize = (s) => {
    const t = String(s || '').trim().toLowerCase()
    if (t === 'win' || t === 'won') return 'won'
    if (t === 'loss' || t === 'lost') return 'lost'
    if (t === 'pending') return 'pending'
    return t
  }
  const listRaw = Array.isArray(statuses) ? statuses : []
  const list = listRaw.filter(Boolean).map(normalize)
  const fb = normalize(fallbackStatus || 'pending')
  if (list.length === 0) return fb

  const total = list.length
  const won = list.filter(s => s === 'won').length
  const lost = list.filter(s => s === 'lost').length

  if (won === total) return 'won'
  if (lost >= 1 && (won + lost) === total) return 'lost'
  return 'pending'
}
