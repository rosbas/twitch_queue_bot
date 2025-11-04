import escapeHtml from 'escape-html'

export const createQueueService = () => {
  let queue = []
  const listeners = new Set()

  const sanitizeTitle = (raw) => escapeHtml(String(raw ?? '').trim().slice(0, 120))
  const notify = () => {
    const snapshot = queue.map(item => ({ ...item }))
    listeners.forEach(listener => listener(snapshot))
  }

  const addSong = (rawTitle, by) => {
    const title = sanitizeTitle(rawTitle)
    if (!title) return null
    const item = { title, by: by?.trim() || 'Streamer' }
    queue.push(item)
    notify()
    return item
  }

  const skipSong = () => {
    if (!queue.length) return null
    const skipped = queue.shift()
    notify()
    return skipped
  }

  const removeSong = (index) => {
    const idx = Number(index)
    if (!Number.isInteger(idx) || idx < 1 || idx > queue.length) return null
    const removed = queue.splice(idx - 1, 1)[0]
    notify()
    return removed
  }

  const clearQueue = () => {
    if (!queue.length) return false
    queue = []
    notify()
    return true
  }

  const getQueue = () => queue.map(item => ({ ...item }))
  const size = () => queue.length

  const onChange = (listener) => {
    listeners.add(listener)
    return () => listeners.delete(listener)
  }

  return { addSong, skipSong, removeSong, clearQueue, getQueue, size, onChange }
}
