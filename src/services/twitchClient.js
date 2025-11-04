import tmi from 'tmi.js'

export const createTwitchClient = ({ identity, channels, onMessage }) => {
  const client = new tmi.Client({ identity, channels })
  if (onMessage) {
    client.on('message', (channel, tags, msg, self) => {
      onMessage({ client, channel, tags, msg, self })
    })
  }
  return client
}
