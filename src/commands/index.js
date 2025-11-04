export const createCommandRouter = ({ queueService, speak, announceQueue, isMac, commandToggleState }) => {
  return ({ platform, channel, message, displayName, reply, isMod, isBroadcaster, self }) => {
    if (self) return
    const text = message?.trim()
    if (!text) return

    const safeReply = reply || (() => {})
    const privileged = Boolean(isMod || isBroadcaster)
    const [cmd, ...rest] = text.split(/\s+/)

    const summary = () => queueService.getQueue().slice(0, 5).map(q => q.title).join(' | ') || 'empty'

    const handleTts = () => {
      const payload = rest.join(' ')
      if (!payload) return
      speak(`${displayName || 'Viewer'} says ${payload}`)
    }

    const handleSong = () => {
      if (!rest.length) return
      const item = queueService.addSong(rest.join(' '), displayName)
      if (item) safeReply(`Queued: ${item.title} (#${queueService.size()})`)
    }

    const handleSkip = () => {
      if (!privileged) return
      if (queueService.skipSong()) safeReply(`Skipped. ${queueService.size()} left.`)
    }

    const handleRemove = () => {
      if (!privileged) return
      const removed = queueService.removeSong(rest[0])
      if (removed) safeReply(`Removed: ${removed.title}`)
    }

    const handleClear = () => {
      if (!privileged) return
      if (queueService.clearQueue()) safeReply(`Queue cleared.`)
    }

    const handleQueue = () => {
      if (platform === 'twitch') {
        announceQueue(channel)
      } else {
        safeReply(`Next: ${summary()}`)
      }
    }

    const commandConfig = {
      '!tts': { key: 'tts', run: handleTts },
      '!song': { key: 'song', run: handleSong },
      '!skip': { key: 'skip', run: handleSkip },
      '!pop': { key: 'skip', run: handleSkip },
      '!remove': { key: 'remove', run: handleRemove },
      '!clear': { key: 'clear', run: handleClear },
      '!queue': { key: 'queue', run: handleQueue }
    }

    const commandEntry = commandConfig[cmd]
    const toggled = commandToggleState?.[commandEntry?.key]

    if (commandEntry && (toggled ?? true)) {
      commandEntry.run()
    }
  }
}
