'use client'
import { useEffect, useState, useRef, ChangeEvent } from 'react'

export default function Home() {
  const [socket, setSocket] = useState<WebSocket | null>(null)
  const [joinedRoom, setJoinedRoom] = useState<boolean>(false)
  const [roomIdInput, setRoomIdInput] = useState<string>('')
  const [peerId, setPeerId] = useState<string>('')

  const wsUrl = 'ws://localhost:3000'
  const syncIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const socketRef = useRef<WebSocket | null>(null)
  const roomIdInputRef = useRef<string>('')
  useEffect(() => {
    const ws = new WebSocket(wsUrl)

    ws.onopen = () => {
      console.log('Connected to WebSocket server successfully!')
      socketRef.current = ws
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
          console.log('Syncing:', message.data)

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
        console.log(`inside the socket`, roomIdInputRef.current)
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
    </div>
  )
}
