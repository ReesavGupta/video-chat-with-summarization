import WebSocket, { WebSocketServer } from 'ws'
import { Room } from './room/Room'
import type { Router } from 'mediasoup/node/lib/RouterTypes'

export const createConnection = async (
  wss: WebSocketServer,
  router: Router
) => {
  let rooms: Map<string, Room> = new Map()

  wss.on('connection', (socket: WebSocket) => {
    socket.on('message', async (event) => {
      const message = JSON.parse(event.toString())

      console.log(`this is the message:`, message)

      switch (message.type) {
        case 'join-room':
          await handleJoinRoom(message)
          break
        case 'get-all-peers':
          ;(async (message: { type: string; data: { roomId: string } }) => {
            if (message && message.data) {
              const { roomId } = message.data
              if (rooms.has(roomId)) {
                const room = rooms.get(roomId)
                socket.send(
                  JSON.stringify({
                    peers: room?.peers,
                  })
                )
              }
            }
          })(message)
          break
      }
    })
  })

  async function handleJoinRoom(message: {
    type: string
    data: { roomId: string }
  }) {
    const { roomId } = message.data

    if (!rooms.has(roomId)) {
      const room = new Room(roomId, router)
      await room.init()
      room.addPeer('peerId')
      rooms.set(roomId, room)
    }

    const room = rooms.get(roomId)!
    room.addPeer('peerId')
  }
}
