import WebSocket, { WebSocketServer } from 'ws'
import { Room } from './room/Room'
import type { Router } from 'mediasoup/node/lib/RouterTypes'

export const createConnection = async (
  wss: WebSocketServer,
  router: Router
) => {
  wss.on('connection', (socket: WebSocket) => {
    socket.on('message', async (event) => {
      const message = JSON.parse(event.toString())

      console.log(`this is the message:`, message)

      switch (message.type) {
        case 'join-room':
          await handleJoinRoom(message)
          break
      }
    })
  })

  async function handleJoinRoom(message: {
    type: string
    data: { roomId: string }
  }) {
    const roomId = message.data.roomId
    const room = new Room(roomId, router)
    await room.init()
  }
}
