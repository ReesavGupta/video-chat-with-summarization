import WebSocket, { WebSocketServer } from 'ws'
import { Room } from './room/Room'
import type { Router } from 'mediasoup/node/lib/RouterTypes'
import uuidSingleton from './utils/generateUuid'

export const createConnection = async (
  wss: WebSocketServer,
  router: Router
) => {
  let rooms: Map<string, Room> = new Map()

  wss.on('connection', (socket: WebSocket) => {
    socket.on('message', async (event: string) => {
      const message = JSON.parse(event)

      console.log(`this is the message:`, message)

      switch (message.type) {
        case 'join-room':
          await handleJoinRoom(socket, message)
          break
        case 'get-all-peers':
          await getAllPeers(socket, message)
          break
      }
    })
  })

  async function handleJoinRoom(
    socket: WebSocket,
    message: {
      type: string
      data: { roomId: string }
    }
  ) {
    const { roomId } = message.data

    const peerId = uuidSingleton.generate()
    if (!rooms.has(roomId)) {
      const room = new Room(roomId, router)
      await room.init()
      // i need to generate a uuid and send it back to the client here

      room.addPeer(peerId)
      rooms.set(roomId, room)
    }

    const room = rooms.get(roomId)!
    room.addPeer(peerId)
    socket.send(
      JSON.stringify({
        type: 'joined-room',
        data: {
          peerId,
        },
      })
    )
  }

  async function getAllPeers(
    socket: WebSocket,
    message: { type: string; data: { roomId: string } }
  ) {
    if (message && message.data) {
      const { roomId } = message.data
      console.log(`this is roomId: `, roomId)
      // console.log(`rooms:`, rooms)
      if (rooms.has(roomId)) {
        const room = rooms.get(roomId)
        socket.send(
          JSON.stringify({
            type: 'all-peers',
            peers: room?.peers,
          })
        )
      }
    }
  }
}
