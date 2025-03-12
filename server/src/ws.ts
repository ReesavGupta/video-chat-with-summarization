import WebSocket, { WebSocketServer } from 'ws'
import { createMediasoupWorkerAndRouter } from './lib/worker'

export const createConnection = async (wss: WebSocketServer) => {
  //
  // start mediasoup with a single worker and router
  //
  const result = await createMediasoupWorkerAndRouter()
  if (!result) {
    throw new Error('Failed to create Mediasoup worker and router')
  }
  const { worker, router, audioLevelObserver } = result

  wss.on('connection', (socket: WebSocket) => {
    console.log(`someone is here`)
  })
}
