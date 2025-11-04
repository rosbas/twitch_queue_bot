(function (global) {
  const itemClasses =
    'relative my-1.5 rounded-lg px-3 py-2 pr-11 backdrop-blur-sm transition-colors'
  const indexClasses = 'font-medium'
  const titleClasses = 'font-semibold'
  const bylineClasses = 'font-medium'
  const removeButtonClasses =
    'absolute right-2 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border text-lg transition focus:outline-none focus:ring-2 focus:ring-accent/70'

  const defaultTheme = {
    queueBg: '#1f2937',
    textPrimary: '#ffffff',
    textSecondary: '#b3b3b3'
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

  function createRenderer({ listEl, allowRemoval = false, onRemove, getTheme, getLayout }) {
    if (!listEl) throw new Error('listEl is required for queue renderer')

    let lastItems = []

    const render = (items) => {
      if (Array.isArray(items)) {
        lastItems = items
      }
      const snapshot = Array.isArray(items) ? items : lastItems

      const removalEnabled =
        allowRemoval &&
        typeof onRemove === 'function' &&
        !document.body.classList.contains('is-obs')
      const theme = Object.assign(
        {},
        defaultTheme,
        typeof getTheme === 'function' ? getTheme() : {}
      )
      const layout = Object.assign(
        { align: 'left' },
        typeof getLayout === 'function' ? getLayout() : {}
      )
      const textAlign = ['left', 'center', 'right'].includes(layout.align) ? layout.align : 'left'

      listEl.style.textAlign = textAlign

      listEl.innerHTML = ''
      if (!snapshot?.length) {
        const emptyLi = document.createElement('li')
        emptyLi.className = 'italic'
        emptyLi.textContent = 'queue is empty'
        emptyLi.style.color = theme.textSecondary
        emptyLi.style.opacity = '0.7'
        listEl.appendChild(emptyLi)
        return
      }

      snapshot.forEach((item, idx) => {
        const li = document.createElement('li')
        li.dataset.index = String(idx + 1)
        li.className = itemClasses
        li.style.display = 'block'
        li.style.backgroundColor = hexToRgba(theme.queueBg, 0.65)
        li.style.color = theme.textPrimary
        li.style.textAlign = textAlign

        const number = document.createElement('span')
        number.className = indexClasses
        number.textContent = `${idx + 1}.`
        number.style.display = 'inline-block'
        if (textAlign === 'right') {
          number.style.marginLeft = '12px'
          number.style.marginRight = '0'
        } else if (textAlign === 'center') {
          number.style.marginLeft = '12px'
          number.style.marginRight = '12px'
        } else {
          number.style.marginLeft = '0'
          number.style.marginRight = '12px'
        }
        number.style.color = theme.textSecondary
        li.appendChild(number)

        const title = document.createElement('span')
        title.className = titleClasses
        title.textContent = item.title
        title.style.display = 'inline-block'
        const titleOffset = removalEnabled ? 72 : 32
        title.style.maxWidth = `calc(100% - ${titleOffset}px)`
        title.style.verticalAlign = 'middle'
        title.style.overflow = 'hidden'
        title.style.textOverflow = 'ellipsis'
        title.style.whiteSpace = 'nowrap'
        title.style.color = theme.textPrimary
        li.appendChild(title)

        const by = document.createElement('span')
        by.className = bylineClasses
        by.textContent = `— ${item.by}`
        by.style.display = 'inline-block'
        if (textAlign === 'right') {
          by.style.marginLeft = '8px'
          by.style.marginRight = '0'
        } else if (textAlign === 'center') {
          by.style.marginLeft = '8px'
          by.style.marginRight = '8px'
        } else {
          by.style.marginLeft = '8px'
          by.style.marginRight = '0'
        }
        by.style.maxWidth = `calc(100% - ${removalEnabled ? 96 : 48}px)`
        by.style.color = theme.textSecondary
        li.appendChild(by)

        if (removalEnabled) {
          const removeBtn = document.createElement('button')
          removeBtn.type = 'button'
          removeBtn.className = removeButtonClasses
          removeBtn.setAttribute('aria-label', `Remove ${item.title}`)
          removeBtn.textContent = '×'
          removeBtn.style.color = theme.textSecondary
          removeBtn.style.borderColor = theme.textSecondary
          removeBtn.style.backgroundColor = hexToRgba(theme.queueBg, 0.4)
          removeBtn.addEventListener('mouseenter', () => {
            removeBtn.style.color = theme.textPrimary
            removeBtn.style.backgroundColor = hexToRgba(theme.queueBg, 0.55)
          })
          removeBtn.addEventListener('mouseleave', () => {
            removeBtn.style.color = theme.textSecondary
            removeBtn.style.backgroundColor = hexToRgba(theme.queueBg, 0.4)
          })
          removeBtn.addEventListener('click', (event) => {
            event.stopPropagation()
            const index = Number(li.dataset.index)
            if (!Number.isInteger(index)) return
            onRemove(index)
          })
          li.appendChild(removeBtn)
        }

        listEl.appendChild(li)
      })
    }

    render.refresh = () => render()

    return render
  }

  global.QueueUI = Object.assign({}, global.QueueUI, { createRenderer })
})(window)
