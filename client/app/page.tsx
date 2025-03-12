'use client'
import { useEffect } from 'react'

export default function Home() {
  const wsUrl = 'http://localhost:3000'
  useEffect(() => {
    const socket = new WebSocket(wsUrl)
  }, [])
  return (
    <div>
      <div>this is hello world</div>
    </div>
  )
}
