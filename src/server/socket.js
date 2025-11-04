import { Server } from 'socket.io'

export const createSocketServer = ({ httpServer, queueService }) => {
  const io = new Server(httpServer, { cors: { origin: '*' } })

  const emitQueue = (snapshot) => {
    io.emit('queue', snapshot)
  }

  queueService.onChange(emitQueue)

  io.on('connection', (sock) => {
    sock.emit('queue', queueService.getQueue())
  })

  return io
}
