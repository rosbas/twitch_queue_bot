import 'dotenv/config'
import { config, isMac } from './src/config.js'
import { createQueueService } from './src/queue/service.js' //music queue are here
import { createQueueAnnouncer } from './src/queue/announcer.js' //announce function, im disabling it
import { createHttpServer } from './src/server/http.js' //Server for the apis + overlay
import { createSocketServer } from './src/server/socket.js' //Server for two-way connection to both Twitch and YT
import { createTts } from './src/services/tts.js'
import { createCommandRouter } from './src/commands/index.js' // To enable which command is allow from chatters => Will connect it web later
import { createTwitchClient } from './src/services/twitchClient.js'
import { createObsClient } from './src/services/obsClient.js'
import { createYoutubeClient } from './src/services/youtubeClient.js'
import { promises as fs } from 'fs'
import path from 'path'

const SETTINGS_PATH = path.resolve('data/settings.json')

const readSettings = async () => {
  try {
    const raw = await fs.readFile(SETTINGS_PATH, 'utf8')
    return JSON.parse(raw)
  } catch (err) {
    return {}
  }
}

const debounce = (fn, delay) => {
  let timer
  return (...args) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), delay)
  }
}

const writeSettings = debounce(async (snapshot) => {
  try {
    await fs.mkdir(path.dirname(SETTINGS_PATH), { recursive: true })
    await fs.writeFile(SETTINGS_PATH, JSON.stringify(snapshot, null, 2), 'utf8')
  } catch (err) {
    console.error('Failed to persist settings', err)
  }
}, 250)

const queueService = createQueueService()

const sayTargets = []
const aggregatedSay = (channel, message) => {
  sayTargets.forEach((target) => {
    try {
      target(channel, message)
    } catch (err) {
      console.error('Announce target failed', err)
    }
  })
}

const announceQueue = createQueueAnnouncer({
  queueService,
  getDefaultChannel: () => config.twitch.channel,
  say: aggregatedSay
})

const { httpServer } = createHttpServer({
  queueService,
  announceQueue,
  staticDir: config.staticDir
})

const MIN_QUEUE_WIDTH = 320
const MAX_QUEUE_WIDTH = 960

const clampWidth = (value) => Math.min(MAX_QUEUE_WIDTH, Math.max(MIN_QUEUE_WIDTH, value))

const state = {
  commandToggle: {
    tts: isMac,
    song: true,
    skip: false,
    remove: false,
    clear: false,
    queue: false
  },
  alignment: { align: 'center', width: 560 },
  theme: {
    overlayBg: '#101827',
    queueBg: '#1f2937',
    textPrimary: '#ffffff',
    textSecondary: '#b3b3b3'
  }
}

const persistSettings = () => {
  writeSettings({
    commandToggle: state.commandToggle,
    alignment: state.alignment,
    theme: state.theme
  })
}

const HEX_COLOR_RE = /^#([0-9a-fA-F]{6})$/
const loadSettings = async () => {
  const persisted = await readSettings()
  if (persisted.commandToggle && typeof persisted.commandToggle === 'object') {
    Object.entries(persisted.commandToggle).forEach(([key, value]) => {
      if (key in state.commandToggle) {
        state.commandToggle[key] = Boolean(value)
      }
    })
  }
  if (persisted.alignment && typeof persisted.alignment === 'object') {
    const { align, width } = persisted.alignment
    if (['left', 'center', 'right'].includes(align)) {
      state.alignment.align = align
    }
    if (Number.isFinite(width)) {
      state.alignment.width = clampWidth(width)
    }
  }
  if (persisted.theme && typeof persisted.theme === 'object') {
    Object.entries(persisted.theme).forEach(([key, value]) => {
      if (key in state.theme && typeof value === 'string' && HEX_COLOR_RE.test(value)) {
        state.theme[key] = value
      }
    })
  }
  persistSettings()
}

const settingsPromise = loadSettings()

const io = createSocketServer({ httpServer, queueService })

io.on('connection', (socket) => {
  settingsPromise.then(() => {
    socket.emit('command-toggle-snapshot', { ...state.commandToggle })
    socket.emit('overlay-align', { ...state.alignment })
    socket.emit('overlay-theme', { ...state.theme })

    socket.on('command-toggle', ({ key, enabled }) => {
      if (state.commandToggle && key in state.commandToggle) {
        state.commandToggle[key] = Boolean(enabled)
        persistSettings()
        io.emit('command-toggle-snapshot', { ...state.commandToggle })
      }
    })

    socket.on('overlay-align', ({ align, width } = {}) => {
      let changed = false
      if (align && ['left', 'center', 'right'].includes(align) && align !== state.alignment.align) {
        state.alignment.align = align
        changed = true
      }
      if (Number.isFinite(width)) {
        const clamped = clampWidth(width)
        if (clamped !== state.alignment.width) {
          state.alignment.width = clamped
          changed = true
        }
      }
      if (changed) {
        persistSettings()
        io.emit('overlay-align', { ...state.alignment })
      }
    })

    socket.on('overlay-theme-update', (incoming) => {
      if (!incoming || typeof incoming !== 'object') return
      const keys = ['overlayBg', 'queueBg', 'textPrimary', 'textSecondary']
      let changed = false
      keys.forEach((key) => {
        const value = incoming[key]
        if (typeof value === 'string' && HEX_COLOR_RE.test(value) && value !== state.theme[key]) {
          state.theme[key] = value
          changed = true
        }
      })
      if (changed) {
        persistSettings()
        io.emit('overlay-theme', { ...state.theme })
      }
    })
  })
})

const { speak } = createTts({
  isMac,
  voice: config.voices.en,
  speed: config.tts.speed
})

const commandRouter = createCommandRouter({
  queueService,
  speak,
  announceQueue,
  isMac,
  commandToggleState: state.commandToggle
})

const hasTwitchCredentials =
  Boolean(config.twitch.username) && Boolean(config.twitch.oauth) && Boolean(config.twitch.channel)
let twitchClient

if (hasTwitchCredentials) {
  twitchClient = createTwitchClient({
    identity: { username: config.twitch.username, password: config.twitch.oauth },
    channels: [config.twitch.channel],
    onMessage: ({ client, channel, tags, msg, self }) => {
      commandRouter({
        platform: 'twitch',
        channel,
        message: msg,
        displayName: tags['display-name'],
        reply: (text) => client.say(channel, text),
        isMod: Boolean(tags.mod),
        isBroadcaster: tags.badges?.broadcaster === '1',
        self
      })
    }
  })

  sayTargets.push((channel, message) => {
    const target = channel || config.twitch.channel
    if (!target) return
    twitchClient.say(target, message)
  })
} else {
  console.warn('Twitch client disabled: missing TWITCH_USERNAME/OAUTH/CHANNEL')
  twitchClient = {
    isEnabled: false,
    connect: async () => {
      console.warn('Twitch connect skipped (client disabled)')
    },
    say: () => {
      console.warn('Twitch say skipped (client disabled)')
    }
  }
}

let youtubeClient
const handleYoutubeMessage = (payload) => {
  commandRouter({
    ...payload,
    reply: (text) => youtubeClient.sendMessage(payload.channel, text)
  })
}

youtubeClient = createYoutubeClient({
  liveChatId: config.youtube.liveChatId,
  pollIntervalMs: config.youtube.pollIntervalMs,
  oauth: config.youtube.oauth,
  onMessage: handleYoutubeMessage
})

if (youtubeClient.isEnabled) {
  sayTargets.push((channel, message) => {
    const target = channel || config.youtube.liveChatId
    if (!target || target.startsWith('DUMMY_')) return
    youtubeClient.sendMessage(target, message)
  })
  youtubeClient.start()
}

const obsEnableFlag = process.env.OBS_ENABLED
const hasObsEnv = process.env.OBS_URL !== undefined || process.env.OBS_PASSWORD !== undefined
const isObsEnabled = obsEnableFlag !== undefined ? obsEnableFlag.toLowerCase() !== 'false' : hasObsEnv
const obs = isObsEnabled ? createObsClient() : null

if (!isObsEnabled) {
  console.warn('OBS client disabled: missing OBS configuration or OBS_ENABLED=false')
}

;(async () => {
  try {
    const connected = []
    if (hasTwitchCredentials) {
      await twitchClient.connect()
      console.log('Twitch client connected')
      connected.push('twitch')
    }
    if (obs) {
      await obs.connect(config.obs.url, config.obs.password)
      console.log('OBS client connected')
      connected.push('obs')
    }
    if (connected.length === 0) {
      console.log('External services disabled: running in demo mode')
    }
  } catch (err) {
    console.error('Startup failed', err)
  }
})()

httpServer.listen(config.port, () => {
  console.log(`Overlay:  http://localhost:${config.port}/overlay`)
})
