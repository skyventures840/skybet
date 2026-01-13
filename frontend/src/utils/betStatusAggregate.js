export function aggregateBetStatus (statuses, fallbackStatus = 'pending') {
  const list = (statuses || []).filter(Boolean)
  if (list.length === 0) return String(fallbackStatus || 'pending').toLowerCase()
  if (list.some(s => s === 'pending')) return 'pending'
  if (list.every(s => s === 'won')) return 'won'
  if (list.some(s => s === 'lost')) return 'lost'
  if (list.some(s => s === 'void')) return 'void'
  return String(fallbackStatus || 'pending').toLowerCase()
}

