import http from 'http'
import express from 'express'
import { createConnection } from '../src/ws'
import { WebSocketServer } from 'ws'
import { createMediasoupWorkerAndRouter } from './lib/worker'

const expressApp = express()
const server = http.createServer(expressApp)
const wss = new WebSocketServer({ server })

//
// start mediasoup with a single worker and router
//
const result = await createMediasoupWorkerAndRouter()
if (!result) {
  throw new Error('Failed to create Mediasoup worker and router')
}
const { worker, router } = result

createConnection(wss, router)

const port = 3000

server.listen(port, () => {
  console.log(`server is listening on port: ${port}`)
})

export { router }
