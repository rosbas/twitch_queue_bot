export const createQueueAnnouncer = ({ queueService, getDefaultChannel, say }) => {
  return (channel) => {
    const targetChannel = channel || getDefaultChannel()
    if (!targetChannel) throw new Error('No Twitch channel configured')
    const list = queueService.getQueue().slice(0, 5).map(q => q.title).join(' | ') || 'empty'
    say(targetChannel, `Next: ${list}`)
    return list
  }
}
