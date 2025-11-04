import { google } from 'googleapis'

const isDummy = (value) => !value || value.startsWith('DUMMY_')

export const createYoutubeClient = ({ liveChatId, pollIntervalMs = 5000, oauth = {}, onMessage }) => {
  const missingAuth = [
    oauth.clientId,
    oauth.clientSecret,
    oauth.refreshToken
  ].some(isDummy)

  if (isDummy(liveChatId) || missingAuth) {
    console.warn('YouTube client disabled: missing credentials')
    const noOp = async () => {
      console.warn('YouTube sendMessage ignored (client disabled)')
    }
    return {
      start: () => {},
      stop: () => {},
      sendMessage: noOp,
      isEnabled: false
    }
  }

  const oauthClient = new google.auth.OAuth2(oauth.clientId, oauth.clientSecret)
  const credentials = { refresh_token: oauth.refreshToken }
  if (!isDummy(oauth.accessToken)) {
    credentials.access_token = oauth.accessToken
  }
  oauthClient.setCredentials(credentials)

  const youtube = google.youtube({ version: 'v3', auth: oauthClient })
  const seenIds = new Set()
  const seenOrder = []
  let nextPageToken
  let polling = false
  let timeoutId

  const remember = (id) => {
    if (!id) return false
    if (seenIds.has(id)) return true
    seenIds.add(id)
    seenOrder.push(id)
    if (seenOrder.length > 1000) {
      const oldest = seenOrder.shift()
      seenIds.delete(oldest)
    }
    return false
  }

  const emitMessage = (item) => {
    const snippet = item.snippet
    const author = item.authorDetails
    const message = snippet?.displayMessage
    if (!message) return
    onMessage?.({
      platform: 'youtube',
      channel: liveChatId,
      message,
      displayName: author?.displayName,
      reply: (text) => {
        console.warn('Unable to reply to YouTube chat without OAuth credentials', text)
      },
      isMod: Boolean(author?.isChatModerator),
      isBroadcaster: Boolean(author?.isChatOwner),
      self: false
    })
  }

  const poll = async () => {
    if (!polling) return
    try {
      const { data } = await youtube.liveChatMessages.list({
        liveChatId,
        part: ['snippet', 'authorDetails'],
        pageToken: nextPageToken,
        maxResults: 200
      })
      nextPageToken = data.nextPageToken || nextPageToken
      const items = data.items || []
      items.forEach((item) => {
        if (remember(item.id)) return
        emitMessage(item)
      })
      const delay = data.pollingIntervalMillis || pollIntervalMs
      timeoutId = setTimeout(poll, delay)
    } catch (err) {
      console.error('YouTube poll failed', err.message)
      timeoutId = setTimeout(poll, pollIntervalMs * 2)
    }
  }

  const start = () => {
    if (polling) return
    polling = true
    poll()
  }

  const stop = () => {
    polling = false
    if (timeoutId) {
      clearTimeout(timeoutId)
      timeoutId = undefined
    }
  }

  const sendMessage = async (channel, text) => {
    console.warn('Sending messages to YouTube chat requires liveChatMessages.insert implementation', { channel, text })
  }

  return { start, stop, sendMessage, isEnabled: true }
}
