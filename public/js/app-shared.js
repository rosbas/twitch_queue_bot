(function (global) {
  const COMMANDS = [
    { key: 'tts', label: 'TTS' },
    { key: 'song', label: 'Song' },
    { key: 'skip', label: 'Skip' },
    { key: 'remove', label: 'Remove' },
    { key: 'clear', label: 'Clear' },
    { key: 'queue', label: 'Queue' }
  ]

  const THEME_KEYS = ['overlayBg', 'queueBg', 'textPrimary', 'textSecondary']
  const HEX_COLOR_RE = /^#([0-9a-fA-F]{6})$/
  const THEME_DEFAULTS = {
    overlayBg: '#101827',
    queueBg: '#1f2937',
    textPrimary: '#ffffff',
    textSecondary: '#b3b3b3'
  }

  const classSets = {
    enabled: ['bg-accent/30', 'border-accent', 'text-white', 'shadow-lg'],
    disabled: ['bg-white/10', 'border-white/20', 'text-white/60', 'shadow-none']
  }

  const applyButtonState = (button, enabled) => {
    button.setAttribute('aria-pressed', String(enabled))
    classSets.enabled.forEach(cls => button.classList.toggle(cls, enabled))
    classSets.disabled.forEach(cls => button.classList.toggle(cls, !enabled))
  }

  const removeAlignmentClasses = (target) => {
    target.classList.remove('ml-0', 'mr-0', 'ml-auto', 'mr-auto', 'mx-auto')
  }

  const createSocket = () => global.io({ transports: ['websocket'] })

  const createQueueRenderer = ({ subscribeToTheme, subscribeToLayout, ...options }) => {
    const renderer = global.QueueUI.createRenderer(options)
    if (typeof subscribeToTheme === 'function') {
      subscribeToTheme(() => renderer.refresh?.())
    }
    if (typeof subscribeToLayout === 'function') {
      subscribeToLayout(() => renderer.refresh?.())
    }
    return renderer
  }

  const hexToRgba = (hex, alpha = 1) => {
    if (typeof hex !== 'string') return hex
    const sanitized = hex.replace('#', '')
    if (sanitized.length !== 6) return hex
    const int = parseInt(sanitized, 16)
    const r = (int >> 16) & 255
    const g = (int >> 8) & 255
    const b = int & 255
    return `rgba(${r}, ${g}, ${b}, ${alpha})`
  }

  const initCommandToggles = ({ container, socket }) => {
    if (!container || !socket) return null

    const state = Object.create(null)
    const buttons = new Map()

    const refresh = () => {
      buttons.forEach((button, key) => {
        const enabled = Boolean(state[key])
        applyButtonState(button, enabled)
      })
    }

    const applySnapshot = (snapshot = {}) => {
      COMMANDS.forEach(({ key }) => {
        if (snapshot[key] !== undefined) {
          state[key] = Boolean(snapshot[key])
        } else if (state[key] === undefined) {
          state[key] = false
        }
      })
      refresh()
    }

    COMMANDS.forEach(({ key, label }) => {
      if (state[key] === undefined) state[key] = false
      const button = document.createElement('button')
      button.type = 'button'
      button.dataset.key = key
      button.textContent = label
      button.className =
        'rounded-lg border px-3 py-1 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-accent/60'
      button.addEventListener('click', () => {
        const next = !state[key]
        state[key] = next
        refresh()
        socket.emit('command-toggle', { key, enabled: next })
      })
      container.appendChild(button)
      buttons.set(key, button)
    })

    socket.on('command-toggle-snapshot', applySnapshot)
    applySnapshot()

    return {
      state,
      refresh,
      applySnapshot
    }
  }

  const initAlignmentControls = ({ wrapper, socket, buttons }) => {
    if (!wrapper || !socket) return null

    const MIN_WIDTH = 320
    const MAX_WIDTH = 960

    const buttonList = Array.from(buttons || [])
    const validAlignments = new Set(['left', 'center', 'right'])
    const subscribers = new Set()
    const current = {
      align: 'center',
      width: Math.round(wrapper.getBoundingClientRect().width || 560)
    }

    const clamp = (value) => Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, value))

    const notify = () => {
      const snapshot = { ...current }
      subscribers.forEach(fn => fn(snapshot))
    }

    const updateButtons = (align) => {
      buttonList.forEach((btn) => {
        const active = btn.dataset.align === align
        applyButtonState(btn, active)
      })
    }

    const apply = (payload, { emit = false } = {}) => {
      const incoming = typeof payload === 'string' ? { align: payload } : (payload || {})
      const nextAlign = validAlignments.has(incoming.align) ? incoming.align : current.align
      const widthCandidate = typeof incoming.width === 'number' ? clamp(incoming.width) : current.width
      const changed = nextAlign !== current.align || widthCandidate !== current.width
      current.align = nextAlign
      current.width = widthCandidate

      removeAlignmentClasses(wrapper)
      if (current.align === 'left') {
        wrapper.classList.add('ml-0', 'mr-auto')
      } else if (current.align === 'center') {
        wrapper.classList.add('mx-auto')
      } else {
        wrapper.classList.add('ml-auto', 'mr-0')
      }

      wrapper.style.width = `${current.width}px`
      updateButtons(current.align)
      notify()

      if (emit && changed) {
        socket.emit('overlay-align', { align: current.align, width: current.width })
      }
    }

    buttonList.forEach((btn) => {
      btn.addEventListener('click', () => apply({ align: btn.dataset.align }, { emit: true }))
    })

    socket.on('overlay-align', (payload = {}) => apply(payload, { emit: false }))

    apply(current, { emit: false })

    const subscribe = (fn) => {
      if (typeof fn !== 'function') return () => {}
      subscribers.add(fn)
      fn({ ...current })
      return () => subscribers.delete(fn)
    }

    return {
      apply,
      subscribe,
      getState: () => ({ ...current }),
      MIN_WIDTH,
      MAX_WIDTH
    }
  }

  const createThemeManager = ({ socket, onApply }) => {
    if (!socket) return null
    const theme = { ...THEME_DEFAULTS }
    const subscribers = new Set()

    const notify = () => {
      const snapshot = { ...theme }
      subscribers.forEach(fn => fn(snapshot))
      if (typeof onApply === 'function') onApply(snapshot)
    }

    socket.on('overlay-theme', (incoming = {}) => {
      let changed = false
      THEME_KEYS.forEach((key) => {
        const value = incoming[key]
        if (typeof value === 'string' && HEX_COLOR_RE.test(value) && value !== theme[key]) {
          theme[key] = value
          changed = true
        }
      })
      if (changed) notify()
    })

    const update = (partial = {}) => {
      let changed = false
      THEME_KEYS.forEach((key) => {
        const value = partial[key]
        if (typeof value === 'string' && HEX_COLOR_RE.test(value) && value !== theme[key]) {
          theme[key] = value
          changed = true
        }
      })
      if (changed) {
        notify()
        socket.emit('overlay-theme-update', { ...theme })
      }
    }

    const subscribe = (fn) => {
      if (typeof fn !== 'function') return () => {}
      subscribers.add(fn)
      fn({ ...theme })
      return () => subscribers.delete(fn)
    }

    notify()

    return {
      getTheme: () => ({ ...theme }),
      update,
      subscribe
    }
  }

  const initThemeControls = ({ manager, inputs }) => {
    if (!manager || !inputs) return null
    const map = {}
    const list = Array.isArray(inputs) || inputs instanceof NodeList ? inputs : Object.values(inputs)
    list.forEach((input) => {
      const key = input?.dataset?.themeKey
      if (key && THEME_KEYS.includes(key)) {
        map[key] = input
      }
    })

    const applyValues = (theme) => {
      Object.entries(map).forEach(([key, input]) => {
        if (!input) return
        const nextValue = theme[key] || THEME_DEFAULTS[key]
        if (nextValue && input.value !== nextValue) {
          input.value = nextValue
        }
      })
    }

    manager.subscribe(applyValues)

    Object.entries(map).forEach(([key, input]) => {
      input.addEventListener('input', (event) => {
        const value = event.target.value
        if (typeof value === 'string' && HEX_COLOR_RE.test(value)) {
          manager.update({ [key]: value })
        }
      })
    })

    return { applyValues }
  }

  global.QueueApp = {
    COMMANDS,
    THEME_DEFAULTS,
    createSocket,
    createQueueRenderer,
    initCommandToggles,
    initAlignmentControls,
    createThemeManager,
    initThemeControls,
    hexToRgba
  }
})(window)
