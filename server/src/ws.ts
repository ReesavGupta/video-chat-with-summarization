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
          await handleGetAllPeers(socket, message)
          break
        case 'sync':
          await handleSync(message, socket)
          break
      }
    })
  })

  async function handleJoinRoom(
    socket: WebSocket,
    message: { type: string; data: { roomId: string } }
  ) {
    const { roomId } = message.data

    const peerId = uuidSingleton.generate()
    if (!rooms.has(roomId)) {
      const room = new Room(roomId, router)
      await room.init()
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

  async function handleGetAllPeers(
    socket: WebSocket,
    message: { type: string; data: { roomId: string } }
  ) {
    const { roomId } = message.data

    console.log(`this is roomId: `, roomId)

    if (rooms.has(roomId)) {
      const room = rooms.get(roomId)
      socket.send(
        JSON.stringify({
          type: 'all-peers',
          peers: room ? room.peers : [],
        })
      )
    }
  }

  async function handleSync(
    message: { data: { peerId: string; roomId: string }; type: string },
    socket: WebSocket
  ) {
    const { peerId, roomId } = message.data

    if (!peerId) {
      console.error('No peer id :(')
      return
    }

    if (rooms.has(roomId)) {
      const room = rooms.get(roomId)
      socket.send(
        JSON.stringify({
          type: 'on-sync',
          data: {
            activeSpeaker: room?.activeSpeaker || null,
            peers: room?.peers || [],
          },
        })
      )
    }
  }
}
