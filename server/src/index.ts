import http from 'http'
import express from 'express'
import { createConnection } from '../src/ws'
import { WebSocketServer } from 'ws'

const expressApp = express()
const server = http.createServer(expressApp)
const wss = new WebSocketServer({ server })

createConnection(wss)

const port = 3000

server.listen(port, () => {
  console.log(`server is listening on port: ${port}`)
})
