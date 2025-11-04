import express from 'express'
import { createServer } from 'http'

export const createHttpServer = ({ queueService, announceQueue, staticDir }) => {
  const app = express()
  app.use(express.json())
  app.use(express.static(staticDir))

  app.get('/overlay', (_req, res, next) => {
    res.sendFile('overlay/index.html', { root: staticDir }, (err) => {
      if (err) next(err)
    })
  })

  app.get('/api/queue', (_req, res) => {
    res.json(queueService.getQueue())
  })

  app.post('/api/queue', (req, res) => {
    const item = queueService.addSong(req.body?.title, req.body?.by)
    if (!item) return res.status(400).json({ error: 'Title is required' })
    res.status(201).json({ added: item, size: queueService.size() })
  })

  app.post('/api/queue/skip', (_req, res) => {
    const skipped = queueService.skipSong()
    if (!skipped) return res.status(400).json({ error: 'Queue is empty' })
    res.json({ skipped, size: queueService.size() })
  })

  app.post('/api/queue/remove', (req, res) => {
    const removed = queueService.removeSong(req.body?.index)
    if (!removed) return res.status(400).json({ error: 'Provide a valid position' })
    res.json({ removed, size: queueService.size() })
  })

  app.post('/api/queue/clear', (_req, res) => {
    const cleared = queueService.clearQueue()
    if (!cleared) return res.status(400).json({ error: 'Queue already empty' })
    res.json({ cleared: true })
  })

  app.post('/api/queue/announce', (_req, res) => {
    try {
      const announced = announceQueue()
      res.json({ announced })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  const httpServer = createServer(app)
  return { app, httpServer }
}
