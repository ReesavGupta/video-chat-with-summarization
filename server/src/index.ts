import http from 'http'
import express from 'express'
import { createConnection } from '../src/ws'
import { WebSocketServer } from 'ws'
import { createMediasoupWorkerAndRouter } from './lib/mediasoup/worker'

const expressApp = express()
const server = http.createServer(expressApp)
const wss = new WebSocketServer({ server })

const port = 3001

let router: any
let worker: any

createMediasoupWorkerAndRouter()
  .then(async (result) => {
    if (!result) {
      throw new Error('Failed to create Mediasoup worker and router')
    }

    router = result.router
    worker = result.worker

    await createConnection(wss, router)
    console.log(
      'Mediasoup worker and router created. WebSocket handler attached.'
    )
  })
  .catch((err) => {
    console.error('Error initializing mediasoup:', err)
  })

server.listen(port, () => {
  console.log(`server is listening on port: ${port}`)
})

export { router }
