'use client'
import { Device } from 'mediasoup-client'
import {
  MediaKind,
  RtpCapabilities,
  RtpParameters,
} from 'mediasoup-client/lib/RtpParameters'
import {
  AppData,
  Consumer,
  DtlsParameters,
  IceCandidate,
  IceParameters,
  Producer,
  Transport,
} from 'mediasoup-client/lib/types'
import { useEffect, useState, useRef, ChangeEvent } from 'react'
import {
  activeSpeakerType,
  createTransportMessageType,
  handleConsumerCreatedType,
  peersType,
} from './types'
import TrackControl from './components/TrackControl'
import { RemoteAudio, RemoteVideo } from './components/RemoteStreams'
// import { error } from 'console'

export default function Home() {
  const wsUrl = 'ws://localhost:3000'
  // ------------------state-------------------
  const [socket, setSocket] = useState<WebSocket | null>(null)
  const [roomIdInput, setRoomIdInput] = useState<string>('')
  const [joinedRoom, setJoinedRoom] = useState<boolean>(false)

  // ---------------important states-------------
  const [peerId, setPeerId] = useState<string>('')
  const [currentActiveSpeaker, setCurrentActiveSpeaker] =
    useState<activeSpeakerType | null>(null)
  const [peers, setPeers] = useState<peersType | null>(null)

  const [lastPollSyncData, setLastPollSyncData] = useState<peersType>({})

  const [device, setDevice] = useState<Device | null>(null)
  const [localCam, setLocalCam] = useState<MediaStream | null>(null)

  const [sortedPeerList, setSortedPeerList] = useState<
    {
      id: string
      joinTs: any
      media: any
    }[]
  >([])

  const [camVideoProducer, setCamVideoProducer] = useState<Producer | null>(
    null
  )
  const [camAudioProducer, setCamAudioProducer] = useState<Producer | null>(
    null
  )

  const [consumers, setConsumers] = useState<Consumer[]>([])

  // --------------transport-states--------------
  const [transport, setTransport] = useState<Transport | null>(null)

  const [sendTransport, setSendTransport] = useState<Transport | null>(null)
  const [recvTransport, setRecvTransport] = useState<Transport | null>(null)

  // -----------Refs-----------------------------
  const syncIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const socketRef = useRef<WebSocket | null>(null)
  const roomIdInputRef = useRef<string>('')
  const sendTransportRef = useRef<Transport | null>(null)
  const recvTransportRef = useRef<Transport | null>(null)

  const consumerRef = useRef<Consumer | null>(null)
  const consumersRef = useRef<Consumer[]>([])
  const lastPollSyncDataRef = useRef<peersType | null>(null)

  useEffect(() => {
    const ws = new WebSocket(wsUrl)

    ws.onopen = () => {
      console.log('Connected to WebSocket server successfully!')
      socketRef.current = ws

      socketRef.current.send(
        JSON.stringify({ type: 'getRouterRtpCapabilities' })
      )
    }
    ws.onmessage = (event: MessageEvent) => {
      const message = JSON.parse(event.data)
      console.log('WebSocket message received:', message)

      switch (message.type) {
        case 'joined-room':
          handleJoinedRoom(message)
          break
        case 'all-peers':
          console.log('All peers:', message.peers)
          break
        case 'on-sync':
          handleOnSync(message)
          break
        case 'routerCapabilities':
          handleRouterCapabilities(message)
          break
        // case 'consumerCreated':
        //   handleConsumerCreated(message)
        //   break
      }
    }

    setSocket(ws)

    return () => {
      ws.close()
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current) // Cleanup interval on unmount
      }
    }
  }, [])

  useEffect(() => {
    async function startProducing() {
      if (!sendTransportRef.current) {
        console.error(`there is no sendTransportRef`)
        return
      }

      // let camVideoProducer = sendTransportRef.current.produce()

      if (sendTransport) {
        const videoTrack = localCam?.getVideoTracks()[0]

        if (!videoTrack) {
          console.error(`no video track`)
          return
        }

        const videoProducer = await sendTransport.produce({
          track: videoTrack,
          encodings: camEncodings(),
          appData: { mediaTag: 'cam-video' },
        })

        setCamVideoProducer(videoProducer)

        if (getCamPausedState()) {
          try {
            videoProducer.pause()
          } catch (error) {
            console.error(`something went wrong while pausing the video`)
          }
        }

        const audioTrack = localCam.getAudioTracks()[0]

        if (!audioTrack) {
          console.error(`no audio track`)
          return
        }

        const audioProducer = await sendTransport.produce({
          track: audioTrack,
          appData: { mediaTag: 'cam-audio' },
        })

        setCamAudioProducer(audioProducer)

        if (getMicPausedState()) {
          try {
            audioProducer.pause()
          } catch (error) {
            console.error(`something went wrong while pausing the video`)
          }
        }
      }
    }
    if (sendTransportRef.current && localCam) {
      startProducing()
    }
  }, [sendTransportRef.current, localCam])

  function handleJoinedRoom(message: {
    type: string
    data: { peerId: string }
  }) {
    setPeerId(message.data.peerId)
    setJoinedRoom(true)

    // Clear any existing interval before setting a new one
    if (syncIntervalRef.current) {
      clearInterval(syncIntervalRef.current)
    }

    // Poll server every 1 second
    syncIntervalRef.current = setInterval(() => {
      if (socketRef.current) {
        // console.log(`inside the socket`, roomIdInputRef.current)
        socketRef.current.send(
          JSON.stringify({
            type: 'sync',
            data: {
              peerId: message.data.peerId,
              roomId: roomIdInputRef.current,
            },
          })
        )
      }
    }, 1000)
  }

  function handleOnSync(message: {
    type: string
    data: { activeSpeaker: activeSpeakerType; peers: peersType }
  }) {
    const { activeSpeaker, peers } = message.data

    setCurrentActiveSpeaker(activeSpeaker)
    setPeers(peers)

    let updatedConsumers = [...consumers]

    for (let id in lastPollSyncData) {
      if (!peers[id]) {
        updatedConsumers = updatedConsumers.filter(
          (consumer) => consumer.appData.peerId !== id
        )

        console.log('this is updated consumers:', updatedConsumers)
      }
    }
    console.log(`this is the consumers:`, consumers)
    setConsumers(updatedConsumers)
  }

  // function handleOnSync(message: {
  //   type: string
  //   data: { activeSpeaker: activeSpeakerType; peers: peersType }
  // }) {
  //   const { activeSpeaker, peers } = message.data
  //   setCurrentActiveSpeaker(activeSpeaker)
  //   setPeers(peers)

  // always update bandwidth stats and active speaker display
  //---->  // updateActiveSpeaker();
  //---->  // updateCamVideoProducerStatsDisplay();
  //---->  // updateScreenVideoProducerStatsDisplay();
  //---->  // updateConsumersStatsDisplay();

  // decide if we need to update tracks list and video/audio
  // elements. build list of peers, sorted by join time, removing last
  // seen time and stats, so we can easily do a deep-equals
  // comparison. compare this list with the cached list from last
  // poll.

  // let currentSortedPeerList = sortPeers(peers)

  // setSortedPeerList(currentSortedPeerList)

  // let lastSortedPeerList: {
  //   id: string
  //   joinTs: any
  //   media: any
  // }[] = []

  // if (lastPollSyncDataRef.current) {
  //   lastSortedPeerList = sortPeers(lastPollSyncDataRef.current)
  // }

  // console.log(
  //   `this is the currentSortedPeerList: `,
  //   currentSortedPeerList,
  //   '\n\n'
  // )
  // console.log(`this is the lastSortedPeerList: `, lastSortedPeerList, '\n\n')

  // if (!deepEqual(currentSortedPeerList, lastSortedPeerList)) {
  // need to update the display here
  // updateDisplay(peers, currentSortedPeerList)
  // }

  // if a peer has gone away, we need to close all consumers we have
  // for that peer and remove video and audio elements

  // if a peer has stopped sending media that we are consuming, we
  // need to close the consumer and remove video and audio elements

  //   console.log(`this is peers : `, peers)

  //   setLastPollSyncData(peers)
  //   lastPollSyncDataRef.current = peers
  // }

  async function handleRouterCapabilities(message: {
    type: string
    rtpCapabilities: RtpCapabilities
  }) {
    try {
      const device = new Device()
      console.log(`this is the device`, device)
      setDevice(device)
      const routerRtpCapabilities = message.rtpCapabilities
      console.log(`this is routercap: `, routerRtpCapabilities)
      await device.load({ routerRtpCapabilities })
    } catch (e) {
      console.error('there was an error creating the mediasoup device')
    }
  }

  // to publish the local camera stream
  async function shareCameraStreams() {
    await getCam()

    // create a transport for outgoing media, if we don't already have one
    if (!sendTransportRef.current) {
      createTransport('send')
      // setSendTransport(sendTransport)
      console.log(`this is from the inside`)
    }

    // start sending video. the transport logic will initiate a
    // signaling conversation with the server to set up an outbound rtp
    // stream for the camera video track. our createTransport() function
    // includes logic to tell the server to start the stream in a paused
    // state, if the checkbox in our UI is unchecked. so as soon as we
    // have a client-side camVideoProducer object, we need to set it to
    // paused as appropriate, too.

    /**********************************************************
    **********************************************************
    **********************************************************
    **********************************************************
    **********************************************************
    **********************************************************
    **********************************************************

    // the commented code below needs to run only when there is sendTransportRef.current and the mediastream to send


    // if (!sendTransportRef.current) {
    //   console.error(`there is no sendTransportRef`)
    //   return
    // }

    // // let camVideoProducer = sendTransportRef.current.produce()

    // if (sendTransport) {
    //   const videoTrack = localCam?.getVideoTracks()[0]

    //   if (!videoTrack) {
    //     console.error(`no video track`)
    //     return
    //   }

    //   const videoProducer = await sendTransport.produce({
    //     track: videoTrack,
    //     encodings: camEncodings(),
    //     appData: { mediaTag: 'cam-video' },
    //   })

    //   if (getCamPausedState()) {
    //     try {
    //       videoProducer.pause()
    //     } catch (error) {
    //       console.error(`something went wrong while pausing the video`)
    //     }
    //   }

    //   const audioTrack = localCam.getAudioTracks()[0]
    //   if (!audioTrack) {
    //     console.error(`no audio track`)
    //     return
    //   }

    //   const audioProducer = await sendTransport.produce({
    //     track: audioTrack,
    //     appData: { mediaTag: 'cam-audio' },
    //   })

    //   if (getMicPausedState()) {
    //     try {
    //       audioProducer.pause()
    //     } catch (error) {
    //       console.error(`something went wrong while pausing the video`)
    //     }
    //   }
    // }


    **********************************************************
    **********************************************************
    **********************************************************
    **********************************************************
    **********************************************************
    **********************************************************
    **********************************************************/
  }

  async function getCam() {
    if (localCam) {
      return
    }
    try {
      const localCam = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: true,
      })
      setLocalCam(localCam)
    } catch (e) {
      console.error('couldnt get the user camera')
      return
    }
  }

  // utility function to create a transport and hook up signaling logic
  // appropriate to the transport's direction

  function createTransport(direction: string) {
    console.log(`this is the transport's direction ${direction}`)
    console.log(`this is your peerID ${peerId}`)

    // the transport need to be created in the server first and then only in the client side
    if (!socketRef.current) {
      console.error(`there is no socket ref`)
      return
    }

    // ask the server to create a server-side transport object and send
    // us back the info we need to create a client-side transport
    socketRef.current.send(
      JSON.stringify({
        type: 'createTransport',
        data: {
          direction: direction,
          peerId,
          roomId: roomIdInputRef.current,
        },
      })
    )

    function messageHandler(event: MessageEvent) {
      // console.log(`this is event:`, event)

      const message: createTransportMessageType = JSON.parse(
        event.data.toString()
      )

      if (message.type === 'transportCreated' && device && socketRef.current) {
        console.log(`this is the eventListener message: `, message)
        socketRef.current.removeEventListener('message', messageHandler)

        let transport: Transport<AppData>

        if (direction === 'send') {
          transport = device.createSendTransport(message.data.transportOptions)
          setSendTransport(transport!)
          sendTransportRef.current = transport
        } else if (direction === 'recv') {
          transport = device.createRecvTransport(message.data.transportOptions)
          setRecvTransport(transport)
          recvTransportRef.current = transport
          console.log(
            `this is the recieve transport:`,
            recvTransportRef.current
          )
        } else {
          console.error(`bad transport direction `)
          return
        }

        setTransport(transport!)

        // mediasoup-client will emit a connect event when media needs to
        // start flowing for the first time. send dtlsParameters to the
        // server, then call callback() on success or errback() on failure.

        console.log(`this is your client side transport: `, transport)
        recvTransportRef.current
          ? recvTransportRef.current.on(
              'connect',
              ({ dtlsParameters }, callback, errback) => {
                console.log(`you are inside the transport-connect event`)

                if (!socketRef.current) {
                  console.error(
                    `there is no socket inside the transport connect event`
                  )
                  return
                }

                socketRef.current.send(
                  JSON.stringify({
                    type: 'connectTransport',
                    data: {
                      transportId: recvTransportRef.current?.id,
                      dtlsParameters,
                      roomId: roomIdInputRef.current,
                    },
                  })
                )

                const messageHandler = (event: MessageEvent) => {
                  const message = JSON.parse(event.data.toString())
                  if (message.type === 'connected' && socketRef.current) {
                    console.log(
                      `transport is connected sucessfully and the direction is: ${direction}`
                    )
                    callback()
                    socketRef.current.removeEventListener(
                      'message',
                      messageHandler
                    ) // Cleanup
                  }
                }
                socketRef.current.addEventListener('message', messageHandler)
              }
            )
          : sendTransportRef.current?.on(
              'connect',
              ({ dtlsParameters }, callback, errback) => {
                console.log(`you are inside the transport-connect event`)

                if (!socketRef.current) {
                  console.error(
                    `there is no socket inside the transport connect event`
                  )
                  return
                }

                socketRef.current.send(
                  JSON.stringify({
                    type: 'connectTransport',
                    data: {
                      transportId: transport.id,
                      dtlsParameters,
                      roomId: roomIdInputRef.current,
                    },
                  })
                )

                const messageHandler = (event: MessageEvent) => {
                  const message = JSON.parse(event.data.toString())
                  if (message.type === 'connected' && socketRef.current) {
                    console.log(
                      `transport is connected sucessfully and the direction is: ${direction}`
                    )
                    callback()
                    socketRef.current.removeEventListener(
                      'message',
                      messageHandler
                    ) // Cleanup
                  }
                }
                socketRef.current.addEventListener('message', messageHandler)
              }
            )
        if (direction === 'send') {
          // sending transports will emit a produce event when a new track
          // needs to be set up to start sending. the producer's appData is
          // passed as a parameter
          transport.on(
            'produce',
            ({ kind, rtpParameters, appData }, callback, errback) => {
              console.log(`this is the appData.mediaTag:`, appData.mediaTag)

              // we may want to start out paused (if the checkboxes in the ui
              // aren't checked, for each media type. not very clean code, here
              // but, you know, this isn't a real application.)

              let paused = false
              if (appData.mediaTag === 'cam-video') {
                // paused = getCamPausedState()
                paused = false
              } else if (appData.mediaTag === 'cam-audio') {
                // paused = getMicPausedState()
                paused = false
              }

              // tell the server what it needs to know from us in order to set
              // up a server-side producer object, and get back a
              // producer.id. call callback() on success or errback() on
              // failure.
              if (!socketRef.current) {
                console.error(`there is no socket inside tranport produce`)
                return
              }
              const message = JSON.stringify({
                type: 'send-track',
                transportId: transport.id,
                roomId: roomIdInputRef.current,
                peerId,
                kind,
                rtpParameters,
                appData,
              })
              socketRef.current.send(message)

              function onProduceMessageHandler(event: MessageEvent) {
                console.log(`this is onproducemessage Handler`)
                const message = JSON.parse(event.data.toString())
                console.log(`this is the message:`, message)
                const { id } = message
                callback({ id })

                socketRef.current?.removeEventListener(
                  'message',
                  onProduceMessageHandler
                ) //cleanup
              }

              socketRef.current.addEventListener(
                'message',
                onProduceMessageHandler
              )
            }
          )
        } else if (direction === 'recv') {
          recvTransportRef.current?.on('connectionstatechange', (state) => {
            console.log(`this is the state of the connection: ${state}`)

            switch (state) {
              case 'new':
                console.log(`new connection instantiated :thumbsup:`)
                break
              case 'connecting':
                console.log(`we are getting connected...`)
                break
              case 'connected':
                console.log('we are in !!! :D')
                // okay, we're ready. let's ask the peer to send us media
                // the server-side consumer will be started in paused state. wait
                // until we're connected, then send a resume request to the server
                // to get our first keyframe and start displaying video
                console.log(
                  `this is the consumerRef after connection:`,
                  consumerRef.current
                )
                resumeConsumer(consumerRef.current!)

                consumersRef.current.push(consumerRef.current!)
                // consumers.push(consumerRef.current!)
                console.log(
                  `this is consumers after push:`,
                  consumersRef.current
                )
                // addVidoAudio()

                break
              case 'failed':
                console.log(`connection failed`)
            }
          })
        }
      } else {
        return
      }
    }

    // on sending the create trasport message the code below will expect a message and whenever it gets one, you need to call the message handler function

    socketRef.current.addEventListener('message', messageHandler)

    // if (direction === 'send') {
    //   // device?.createSendTransport()
    // }
  }

  function handleJoinRoom() {
    if (roomIdInput && socket) {
      socket.send(
        JSON.stringify({
          type: 'join-room',
          data: { roomId: roomIdInput },
        })
      )
    }
  }

  function handleGetAllPeers() {
    if (roomIdInput && socket) {
      socket.send(
        JSON.stringify({
          type: 'get-all-peers',
          data: { roomId: roomIdInput },
        })
      )
    }
  }
  function onChangeHandler(e: any) {
    setRoomIdInput(e.target.value)
    roomIdInputRef.current = e.target.value
  }

  function subscribeToTrack(subToPeerId: string, mediaTag: string) {
    console.log(`inside subscribe to track`)

    // create a receive transport if we don't already have one

    if (!recvTransport) {
      createTransport('recv')
    }

    let consumer = findConsumerTrack(subToPeerId, mediaTag)

    if (consumer) {
      console.error('already have consumer for track', subToPeerId, mediaTag)
      return
    }

    // ask the server to create a server-side consumer object and send
    // us back the info we need to create a client-side consumer
    if (!socketRef.current) {
      console.error(`no socket inside subscribe to track`)
      return
    }

    const message = {
      type: 'createConsumer',
      roomId: roomIdInputRef.current,
      peerId,
      mediaTag,
      mediaPeerId: subToPeerId,
      rtpCapabilities: device?.rtpCapabilities,
    }

    socketRef.current.send(JSON.stringify(message))

    socketRef.current.addEventListener(
      'message',
      async (event: MessageEvent) => {
        const msg = JSON.parse(event.data)
        if (msg.type === 'consumerCreated') {
          console.log(`this is message inside the event listener:`, msg)

          const {
            consumerType,
            id,
            kind,
            producerId,
            producerPaused,
            rtpParameters,
            type,
          }: {
            consumerType: string
            id: string
            kind: MediaKind
            producerId: string
            producerPaused: boolean
            rtpParameters: RtpParameters
            type: string
          } = msg

          if (!recvTransportRef.current) {
            console.log(`no recieve transport inside event listener`)
            return
          }

          const consumer = await recvTransportRef.current.consume({
            rtpParameters,
            kind,
            id,
            producerId,
            appData: { peerId, mediaTag },
          })

          consumerRef.current = consumer

          // the server-side consumer will be started in paused state. wait
          // until we're connected, then send a resume request to the server
          // to get our first keyframe and start displaying video

          // *********************************************************
          // *********************************************************
          // *********************************************************
          // *********************************************************
          // *********************************************************
          // *********************************************************
          // *********************************************************
          // *********************************************************
          // *********************************************************
          // *********************************************************

          /*
          
          -> the approach did not work for some reason: as i see it it must be because the recvTransport is taing a long time in getting connected

          -> im not sure though :D

          -> to tackle this problem what i did is, in line no: 616 we listen to a connectionStateChange event and when connected we do the rest.  for some reason it works that way but the later doesnt do justice TwT  

          */

          // while (
          //   recvTransportRef.current &&
          //   recvTransportRef.current.connectionState !== 'connected'
          // ) {
          //   console.log(
          //     `recvTransport connection state: ${recvTransportRef.current?.connectionState}`
          //   )
          //   new Promise((resolve) => setTimeout(resolve, 1000)) //equivalent to bun.sleep(100)
          //   // console.log(`the promise has resoce`)
          // }

          // console.log(
          //   `this is the transportref.current: `,
          //   recvTransportRef.current.connectionState
          // )

          // *********************************************************
          // *********************************************************
          // *********************************************************
          // *********************************************************
          // *********************************************************
          // *********************************************************
          // *********************************************************
          // *********************************************************
          // *********************************************************
          // *********************************************************
        }
      }
    )
  }

  function handleConsumerCreated(message: handleConsumerCreatedType) {}

  function unsubscribeFromTrack(peerId: string, mediaTag: string) {
    console.log(`unsubscribe to track`)
  }

  function pauseConsumer(consumer: Consumer) {
    console.log(`pausing the fucking consumer`)
  }
  function resumeConsumer(consumer: Consumer) {
    if (!consumer) {
      console.error(`there is no consumer inside resume consumer`)
      return
    }
    socketRef.current?.send(
      JSON.stringify({
        type: 'resume',
        roomId: roomIdInputRef.current,
        peerId: peerId,
        consumerId: consumer.id,
      })
    )
    consumer.resume()
    try {
    } catch (error) {
      console.error(error)
    }
  }

  // --------------------utils-----------------

  //
  // encodings for outgoing video
  //

  // just two resolutions, for now, as chrome 75 seems to ignore more
  // than two encodings
  //
  function camEncodings() {
    const CAM_VIDEO_SIMULCAST_ENCODINGS = [
      { maxBitrate: 96000, scaleResolutionDownBy: 4 },
      { maxBitrate: 680000, scaleResolutionDownBy: 1 },
    ]

    return CAM_VIDEO_SIMULCAST_ENCODINGS
  }
  function getCamPausedState() {
    // based on the state of a radio button you need to return true or false

    // for now returning false
    return false
  }

  function getMicPausedState() {
    // based on the state of a radio button you need to return true or false

    // for now returning false
    return false
  }

  function sortPeers(peers: peersType) {
    return Object.entries(peers)
      .map(([id, info]) => ({
        id,
        joinTs: info.joinTs,
        media: { ...info.media },
      }))
      .sort((a, b) => (a.joinTs > b.joinTs ? 1 : b.joinTs > a.joinTs ? -1 : 0))
  }

  function deepEqual<T>(arr1: T[], arr2: T[]): boolean {
    if (arr1.length !== arr2.length) return false

    return arr1.every((obj1, index) => {
      const obj2 = arr2[index]

      if (typeof obj1 !== 'object' || typeof obj2 !== 'object') {
        return obj1 === obj2
      }

      return JSON.stringify(obj1) === JSON.stringify(obj2)
    })
  }

  function findConsumerTrack(peerId: string, mediaTag: string) {
    return consumers.find(
      (consumer) =>
        consumer.appData.peerId === peerId &&
        consumer.appData.mediaTag === mediaTag
    )
  }

  return (
    <div>
      <h2>Video Chat App</h2>
      <input
        type="text"
        placeholder="Room ID"
        value={roomIdInput}
        onChange={(e) => onChangeHandler(e)}
        className="border"
      />
      {!joinedRoom && (
        <button
          onClick={handleJoinRoom}
          className="border mx-1 bg-blue-700 text-white"
        >
          Join Room
        </button>
      )}
      <button
        onClick={handleGetAllPeers}
        className="border mx-1 bg-blue-700 text-white"
      >
        Get All Peers
      </button>

      <div className="flex border border-amber-500">
        {camVideoProducer && (
          <TrackControl
            peers={peers!}
            peerName="my"
            mediaTag="cam-video"
            mediaInfo={peers && peers[peerId]?.media?.['cam-video']}
            myPeerId={peerId}
            createTransport={createTransport}
            consumer={undefined}
            onSubscribe={subscribeToTrack}
            onUnsubscribe={unsubscribeFromTrack}
            onPauseConsumer={pauseConsumer}
            onResumeConsumer={resumeConsumer}
          />
        )}

        {camAudioProducer && (
          <TrackControl
            peers={peers!}
            peerName="my"
            mediaTag="cam-audio"
            mediaInfo={peers && peers[peerId].media?.['cam-audio']}
            myPeerId={peerId}
            createTransport={createTransport}
            consumer={undefined}
            onSubscribe={subscribeToTrack}
            onUnsubscribe={unsubscribeFromTrack}
            onPauseConsumer={pauseConsumer}
            onResumeConsumer={resumeConsumer}
          />
        )}

        {/* {camVideoProducer && <TrackControl />} */}

        {/* {camVideoProducer && <TrackControl />} */}

        {/* {sortedPeerList.map((peer) =>
          peer.id !== peerId
            ? Object.entries(peer.media).map(([mediaTag, info]) => (
                <TrackControl
                  key={`${peer.id}-${mediaTag}`}
                  peerName={peer.id}
                  mediaTag={mediaTag}
                  mediaInfo={info as Object}
                  myPeerId={peerId}
                  createTransport={createTransport}
                />
              ))
            : null
        )} */}

        {peers &&
          sortPeers(peers).map(
            (peer) =>
              peer.id !== peerId &&
              Object.entries(peer.media).map(([mediaTag, info]) => {
                const consumer = consumers.find(
                  (c) =>
                    c.appData.peerId === peer.id &&
                    c.appData.mediaTag === mediaTag
                )
                return (
                  <TrackControl
                    peers={peers}
                    key={`${peer.id}-${mediaTag}`}
                    peerName={peer.id}
                    mediaTag={mediaTag}
                    mediaInfo={info as any}
                    myPeerId={peerId}
                    createTransport={createTransport}
                    consumer={consumer}
                    onSubscribe={subscribeToTrack}
                    onUnsubscribe={unsubscribeFromTrack}
                    onPauseConsumer={pauseConsumer}
                    onResumeConsumer={resumeConsumer}
                  />
                )
              })
          )}
      </div>

      <button
        onClick={shareCameraStreams}
        className="border mx-1 bg-blue-700 text-white"
      >
        Camera
      </button>

      <div>
        {/* for video and audio */}
        <div
          id="remote-video"
          className="border h-48"
        >
          {consumersRef.current.map((consumer) => {
            // console.log(`consumer inside map:`, consumer)
            return (
              consumer.kind === 'video' && (
                <RemoteVideo
                  key={consumer.id}
                  consumer={consumer}
                />
              )
            )
          })}
        </div>

        <div
          id="remote-audio"
          className="border h-48"
        >
          {consumersRef.current.map(
            (consumer) =>
              consumer.kind === 'audio' && (
                <RemoteAudio
                  key={consumer.id}
                  consumer={consumer}
                />
              )
          )}
        </div>
      </div>
    </div>
  )
}
