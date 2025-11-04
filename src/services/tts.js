import say from 'say'

export const createTts = ({ isMac, voice, speed }) => {
  const speak = (text) => {
    if (!isMac) return
    const clean = text.replace(/http\S+|@\w+|#\w+/g, '').slice(0, 200)
    if (clean) say.speak(clean, voice, speed)
  }

  return { speak }
}
