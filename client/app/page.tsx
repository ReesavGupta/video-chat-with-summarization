'use client'
import { Device } from 'mediasoup-client'
import { RtpCapabilities } from 'mediasoup-client/lib/RtpParameters'
import {
  AppData,
  DtlsParameters,
  IceCandidate,
  IceParameters,
  Transport,
} from 'mediasoup-client/lib/types'
import { useEffect, useState, useRef, ChangeEvent } from 'react'
import {
  activeSpeakerType,
  createTransportMessageType,
  peersType,
} from './types'

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
  const [device, setDevice] = useState<Device | null>(null)
  const [localCam, setLocalCam] = useState<MediaStream | null>(null)
  // --------------transport-states--------------
  const [transport, setTransport] = useState<Transport | null>(null)

  const [sendTransport, setSendTransport] = useState<Transport | null>(null)
  // -----------Refs-----------------------------
  const syncIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const socketRef = useRef<WebSocket | null>(null)
  const roomIdInputRef = useRef<string>('')

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

    // always update bandwidth stats and active speaker display

    // updateActiveSpeaker();
    // updateCamVideoProducerStatsDisplay();
    // updateScreenVideoProducerStatsDisplay();
    // updateConsumersStatsDisplay();

    // decide if we need to update tracks list and video/audio
    // elements. build list of peers, sorted by join time, removing last
    // seen time and stats, so we can easily do a deep-equals
    // comparison. compare this list with the cached list from last
    // poll.

    // if a peer has gone away, we need to close all consumers we have
    // for that peer and remove video and audio elements

    // if a peer has stopped sending media that we are consuming, we
    // need to close the consumer and remove video and audio elements
  }

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
    if (!sendTransport) {
      createTransport('send')
      // setSendTransport(sendTransport)
    }

    // start sending video. the transport logic will initiate a
    // signaling conversation with the server to set up an outbound rtp
    // stream for the camera video track. our createTransport() function
    // includes logic to tell the server to start the stream in a paused
    // state, if the checkbox in our UI is unchecked. so as soon as we
    // have a client-side camVideoProducer object, we need to set it to
    // paused as appropriate, too.

    let camVideoProducer = sendTransport?.produce()
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

      if (getMicPausedState()) {
        try {
          videoProducer.pause()
        } catch (error) {
          console.error(`something went wrong while pausing the video`)
        }
      }
    }
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
          direction: 'send',
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
        } else if (direction === 'recv') {
          transport = device.createRecvTransport(message.data.transportOptions)
        } else {
          console.error(`bad transport direction `)
          return
        }

        setTransport(transport!)

        // mediasoup-client will emit a connect event when media needs to
        // start flowing for the first time. send dtlsParameters to the
        // server, then call callback() on success or errback() on failure.

        console.log(`this is your client side transport: `, transport)

        transport.on('connect', ({ dtlsParameters }, callback, errback) => {
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
            if (message.type === 'transportConnected' && socketRef.current) {
              console.log(`transport is connected sucessfully`)
              callback()
              socketRef.current.removeEventListener('message', messageHandler) // Cleanup
            }
          }
          socketRef.current.addEventListener('message', messageHandler)
        })

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
                const { id } = message.data
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

      <button
        onClick={shareCameraStreams}
        className="border mx-1 bg-blue-700 text-white"
      >
        Camera
      </button>
    </div>
  )
}
