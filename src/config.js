export const config = {
  port: Number(process.env.PORT || 3000),
  twitch: {
    username: process.env.TWITCH_USERNAME,
    oauth: process.env.TWITCH_OAUTH,
    channel: process.env.TWITCH_CHANNEL
  },
  obs: {
    url: process.env.OBS_URL || 'ws://127.0.0.1:4455',
    password: process.env.OBS_PASSWORD
  },
  youtube: {
    apiKey: process.env.YOUTUBE_API_KEY || 'DUMMY_YOUTUBE_API_KEY',
    liveChatId: process.env.YOUTUBE_LIVE_CHAT_ID || 'DUMMY_YOUTUBE_LIVE_CHAT_ID',
    pollIntervalMs: Number(process.env.YOUTUBE_POLL_INTERVAL_MS || 5000),
    oauth: {
      clientId: process.env.YOUTUBE_OAUTH_CLIENT_ID || 'DUMMY_YOUTUBE_CLIENT_ID',
      clientSecret: process.env.YOUTUBE_OAUTH_CLIENT_SECRET || 'DUMMY_YOUTUBE_CLIENT_SECRET',
      refreshToken: process.env.YOUTUBE_OAUTH_REFRESH_TOKEN || 'DUMMY_YOUTUBE_REFRESH_TOKEN',
      accessToken: process.env.YOUTUBE_OAUTH_ACCESS_TOKEN || 'DUMMY_YOUTUBE_ACCESS_TOKEN'
    }
  },
  voices: {
    en: 'Samantha',
    th: 'Kanya (Enhanced)',
    jp: 'Kyoko (Enhanced)'
  },
  tts: {
    speed: 1,
    file: './tmp/tts.wav'
  },
  staticDir: 'public'
}

export const isMac = process.platform === 'darwin'
