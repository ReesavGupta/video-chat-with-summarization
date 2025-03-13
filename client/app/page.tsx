'use client'
import { useEffect, useState } from 'react'

export default function Home() {
  const [socket, setSocket] = useState<WebSocket | undefined>(undefined)
  const [joinedRoom, setJoinedRoom] = useState<boolean>(false)
  const [roomIdInput, setRoomIdInput] = useState<string>('')
  const [peerId, setPeerId] = useState<string>('')

  const wsUrl = 'http://localhost:3000'

  useEffect(() => {
    const socket = new WebSocket(wsUrl)
    if (socket) {
      setSocket(socket)
      socket.onmessage = (event: MessageEvent) => {
        const message = JSON.parse(event.data)
        console.log(`this is message : `, message)
        switch (message.type) {
          case 'joined-room':
            setPeerId(message.data.peerId)
            setJoinedRoom(true)
            console.log(message.data.peerId)
            break

          case 'all-peers':
            console.log(`this is message.data: `, message.data)
            break
        }
      }
    }
  }, [])

  function handleJoinRoom() {
    console.log(roomIdInput)
    if (roomIdInput) {
      socket?.send(
        JSON.stringify({
          type: 'join-room',
          data: { roomId: roomIdInput },
        })
      )
    }
  }
  function handleGetAllPeers() {
    if (roomIdInput) {
      socket?.send(
        JSON.stringify({
          type: 'get-all-peers',
          data: {
            roomId: roomIdInput,
          },
        })
      )
    }
  }
  return (
    <div>
      <div>this is ajuBhetumKtaHo.io</div>
      <input
        type="text"
        placeholder="room I.D."
        value={roomIdInput}
        onChange={(e) => setRoomIdInput(e.target.value)}
        className="border"
      />
      {!joinedRoom ? (
        <button
          onClick={handleJoinRoom}
          className="border mx-1 bg-blue-700 text-white"
        >
          Join Room
        </button>
      ) : (
        <></>
      )}
      <button
        onClick={handleGetAllPeers}
        className="border mx-1 bg-blue-700 text-white"
      >
        get all peers
      </button>
    </div>
  )
}
