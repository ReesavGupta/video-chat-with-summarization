'use client'
import { useEffect, useState } from 'react'

export default function Home() {
  const [socket, setSocket] = useState<WebSocket | undefined>(undefined)

  const wsUrl = 'http://localhost:3000'

  useEffect(() => {
    const socket = new WebSocket(wsUrl)
    setSocket(socket)
  }, [])

  function handleJoinRoom() {
    const roomId = 'asdasdasdas'
    socket?.send(
      JSON.stringify({
        type: 'join-room',
        data: { roomId },
      })
    )
  }

  return (
    <div>
      <div>this is hello world</div>
      <button onClick={handleJoinRoom}>Join Room</button>
    </div>
  )
}
