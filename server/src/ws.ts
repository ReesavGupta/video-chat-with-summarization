import WebSocket, { WebSocketServer } from 'ws'
import { Room } from './room/Room'
import type { Router } from 'mediasoup/node/lib/RouterTypes'
import uuidSingleton from './utils/generateUuid'
import { createWebRtcTransport } from './lib/createWebRtcTransport'
import type { DtlsParameters } from 'mediasoup/node/lib/WebRtcTransportTypes'
import type {
  AppData,
  Producer,
  RtpParameters,
  Transport,
} from 'mediasoup/node/lib/types'
import type { HandleSendTrackMessageType } from './types/types'

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
        case 'getRouterRtpCapabilities':
          handleGetRouterRtpCapabilities(socket)
          break
        case 'createTransport':
          handleCreateTransport(message, socket)
          break
        case 'connectTransport':
          handleConnectTransport(message, socket)
          break
        case 'send-track':
          handleSendTrack(message, socket)
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

  function handleGetRouterRtpCapabilities(socket: WebSocket) {
    socket.send(
      JSON.stringify({
        type: 'routerCapabilities',
        rtpCapabilities: router.rtpCapabilities,
      })
    )
  }

  async function handleCreateTransport(
    message: {
      type: string
      data: { direction: string; peerId: string; roomId: string }
    },
    socket: WebSocket
  ) {
    const { direction, peerId, roomId } = message.data
    try {
      const { transport, params } = await createWebRtcTransport(
        router,
        direction,
        peerId
      )
      const room = rooms.get(roomId)

      if (!room) {
        console.error('invalid room for user')
        return
      }

      room.transports[transport.id] = transport

      // console.log(`this is rooms.transports:`, room.transports)

      socket.send(
        JSON.stringify({
          type: 'transportCreated',
          data: {
            transportOptions: params,
          },
        })
      )
    } catch (error) {
      console.error('something went wrong while creating a webrtc transport')
      return
    }
  }

  async function handleConnectTransport(
    message: {
      type: string
      data: {
        transportId: string
        dtlsParameters: DtlsParameters
        roomId: string
      }
    },
    socket: WebSocket
  ) {
    const { transportId, dtlsParameters, roomId } = message.data

    const room = rooms.get(roomId)

    if (room) {
      let transport: Transport<AppData> = room.transports[transportId]

      // console.log(`connect transport:`, transport)
      await transport.connect({ dtlsParameters })
      socket.send(
        JSON.stringify({
          type: 'connected',
          data: {
            connected: true,
          },
        })
      )
    }
  }

  async function handleSendTrack(
    message: HandleSendTrackMessageType,
    socket: WebSocket
  ) {
    const {
      peerId,
      roomId,
      appData,
      kind,
      rtpParameters,
      transportId,
      paused = false,
    } = message

    const room = rooms.get(roomId)
    if (!room) {
      console.error('there is no room id')
      return
    }

    let transport: Transport = room.transports[transportId]

    let producer: Producer<AppData> = await transport.produce({
      kind,
      rtpParameters,
      appData: { ...appData, peerId, transportId },
      paused,
    })

    if (!producer) {
      console.error(
        `failed to create a producer for transportId: ${transportId} `
      )
    }

    producer.on('transportclose', () => {
      console.log("producer's transport closed", producer.id)
      closeProducer(producer, room)
    })

    if (producer.kind === 'audio') {
      await room.audioLevelObserver?.addProducer({ producerId: producer.id })
    }

    room.producers[producer.id] = producer

    room.peers[peerId].media[appData.mediaTag as string] = {
      paused,
      encodings: rtpParameters.encodings,
    }
    const msg = JSON.stringify({
      type: 'produced',
      id: producer.id,
    })
    socket.send(msg)
  }
}

// ------------------------utilities----------------------------------

async function closeProducer(producer: Producer, room: Room) {
  try {
    const producerId = producer.id

    producer.close()

    // remove this producer from our roomState.producers list
    delete room.producers[producerId]

    // remove this track's info from our roomState...mediaTag bookkeeping
    delete room.peers[producer.appData.peerId as string].media[
      producer.appData.mediaTag as string
    ]
  } catch (error) {
    console.error(`some error while closing up the producer`)
    return
  }
}
