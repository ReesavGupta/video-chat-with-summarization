import WebSocket, { WebSocketServer } from 'ws'
import { Room } from './room/Room'
import type { Router } from 'mediasoup/node/lib/RouterTypes'
import uuidSingleton from './utils/generateUuid'
import { createWebRtcTransport } from './lib/mediasoup/createWebRtcTransport'
import type { DtlsParameters } from 'mediasoup/node/lib/WebRtcTransportTypes'
import type {
  AppData,
  Consumer,
  Producer,
  RtpCapabilities,
  RtpParameters,
  Transport,
} from 'mediasoup/node/lib/types'
import type { HandleSendTrackMessageType } from './types/types'
import { sleep } from 'bun'
import { startRecording } from './lib/recording/setup/recording'

export const createConnection = async (
  wss: WebSocketServer,
  router: Router
) => {
  let rooms: Map<string, Room> = new Map()

  wss.on('connection', (socket: WebSocket) => {
    console.log(`socket connected: `, socket)
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
        case 'createConsumer':
          handleCreateConsumer(message, socket)
          break
        case 'resume':
          handleResume(message, socket)
          break
        case 'startRecording':
          handleRecording(message, socket)
      }
    })
  })

  async function handleJoinRoom(
    socket: WebSocket,
    message: { type: string; data: { roomId: string } }
  ) {
    const { roomId } = message.data
    console.log(`inside handle join room`)
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

  //
  // create a mediasoup consumer object, hook it up to a producer here
  // on the server side, and send back info needed to create a consumer
  // object on the client side. always start consumers paused. client
  // will request media to resume when the connection completes
  //
  async function handleCreateConsumer(
    message: {
      type: string
      peerId: string
      roomId: string
      mediaTag: string
      mediaPeerId: string
      rtpCapabilities: RtpCapabilities
    },
    socket: WebSocket
  ) {
    const room = rooms.get(message.roomId)

    if (!room) {
      console.error(`this is an invalid roomId`)
      return
    }

    // p.appData ------->
    // {
    //   mediaTag: "cam-video",
    //   peerId: "36314c52-c5bb-4dc8-b696-20769c5ca814",
    //   transportId: "7bfa7b88-4f4b-4c13-a1c8-856697070255",
    // }
    // {
    //   mediaTag: "cam-audio",
    //   peerId: "36314c52-c5bb-4dc8-b696-20769c5ca814",
    //   transportId: "7bfa7b88-4f4b-4c13-a1c8-856697070255",
    // }

    const producer: Producer = Object.values(room.producers).find((p) => {
      return (
        p.appData.mediaTag === message.mediaTag &&
        p.appData.peerId === message.mediaPeerId
      )
    })

    // console.log(`\n\n\n\nthis is the producer:`, producer, '\n\n\n\n')

    if (!producer) {
      console.error(`cannot find the producer`)
      return
    }

    if (
      !router.canConsume({
        producerId: producer.id,
        rtpCapabilities: message.rtpCapabilities,
      })
    ) {
      console.error(`client is incapable of consuming the producer`)
      return
    }

    // it looks like we need to wait for the transport to be created first.
    // if i didnot do this what was happening is ----> the code below could not find the created transport as we were trying to find the trasnport before its creation
    //so we sleep for 500 ms

    //not optimal but this is what we gotta do

    await sleep(500)

    const transport: Transport = Object.values(room.transports).find(
      (trans) => {
        console.log(
          trans.appData.peerId === message.peerId &&
            trans.appData.clientDirection === 'recv'
        )
        return (
          trans.appData.peerId === message.peerId &&
          trans.appData.clientDirection === 'recv'
        )
      }
    )

    const consumer: Consumer<AppData> = await transport.consume({
      producerId: producer.id,
      rtpCapabilities: message.rtpCapabilities,
      paused: true, // see note above about always starting paused
      appData: {
        peerId: message.peerId,
        mediaTag: message.mediaTag,
        mediaPeerId: message.mediaPeerId,
      },
    })

    // need both 'transportclose' and 'producerclose' event handlers,
    // to make sure we close and clean up consumers in all
    // circumstances

    consumer.on('transportclose', () => {
      console.log(`consumers transport closed (consumer id):`, consumer.id)
      closeConsumer(consumer, room)
    })

    consumer.on('producerclose', () => {
      console.log(`consumers producer closed (consumer id):`, consumer.id)
      closeConsumer(consumer, room)
    })

    // stick this consumer in our list of consumers to keep track of,
    // and create a data structure to track the client-relevant state
    // of this consumer

    room.consumers[consumer.id] = consumer
    room.peers[message.peerId].consumerLayers[consumer.id] = {
      currentLayer: null,
      clientSelectedLayer: null,
    }

    console.log(`this is the transport:`, transport)

    // on layer change
    consumer.on('layerschange', (layers) => {
      console.log(
        `consumer layer change: ${message.mediaPeerId} ----> ${message.peerId}`,
        message.mediaTag,
        layers
      )

      if (
        room.peers[message.peerId] &&
        room.peers[message.peerId].consumerLayers[consumer.id]
      ) {
        room.peers[message.peerId].consumerLayers[consumer.id].currentLayer =
          layers && layers.spatialLayer
      }
    })

    const msg = {
      type: 'consumerCreated',
      producerId: producer.id,
      id: consumer.id,
      kind: consumer.kind,
      rtpParameters: consumer.rtpParameters,
      consumerType: consumer.type,
      producerPaused: consumer.producerPaused,
    }
    socket.send(JSON.stringify(msg))
  }

  async function handleResume(
    message: {
      type: string
      roomId: string
      peerId: string
      consumerId: string
    },
    socket: WebSocket
  ) {
    // console.log(`this is the message:`, message)
    const room = rooms.get(message.roomId)

    if (room) {
      const consumer: Consumer | undefined = Object.entries(room.consumers)
        .map(([cId, c]) => (cId === message.consumerId ? c : undefined))
        .find((c) => c !== undefined)

      console.log(`this is the consumer:`, consumer)

      if (!consumer) {
        console.error(`consumer not found`)
        return
      }

      await consumer.resume()

      socket.send(
        JSON.stringify({
          type: 'resumed',
        })
      )
    }
  }
  /*
    this recording is for 
  */

  async function handleRecording(
    message: { roomId: string; type: string },
    socket: WebSocket
  ) {
    console.log(`this is handleRecording`)
    const { roomId } = message
    const room = rooms.get(roomId)
    if (!room) {
      console.error('room not found for recording')
      return
    }
    startRecording(room)
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

async function closeConsumer(consumer: Consumer, room: Room) {
  consumer.close()
  // remove this consumer from our roomState.consumers list

  delete room.consumers[consumer.id]
  // consumer.id

  // remove layer info from from our roomState...consumerLayers bookkeeping
}
