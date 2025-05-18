import type { MediaKind, RtpParameters } from 'mediasoup/types'
import { PORT_RELEASE_DELAY } from '../setup/setupRecording'

// Enhanced port management system
export const usedPorts = new Map<
  number,
  { inUse: boolean; releaseTimer?: NodeJS.Timeout }
>()

// Check if a port is available at the OS level
export function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const dgram = require('dgram')
    const server = dgram.createSocket('udp4')

    server.on('error', () => {
      resolve(false)
      server.close()
    })

    // Use a timeout to prevent hanging
    const timeout = setTimeout(() => {
      resolve(false)
      try {
        server.close()
      } catch (e) {}
    }, 500)

    server.bind(port, () => {
      clearTimeout(timeout)
      server.close()
      resolve(true)
    })
  })
}

// Function to find an available UDP port with better validation
export async function findAvailablePort(
  start: number,
  end: number
): Promise<number> {
  for (let port = start; port <= end; port++) {
    // Skip if port is already marked as in use
    if (usedPorts.get(port)?.inUse) continue

    // Check if port is available at OS level
    if (await isPortAvailable(port)) {
      // Mark port as in use before returning
      usedPorts.set(port, { inUse: true })
      console.log(`Reserved port ${port} for recording`)
      return port
    }
  }
  throw new Error(`No available ports in range ${start}-${end}`)
}

export function getCodecInfoFromRtpParameters(
  kind: MediaKind,
  rtpParameters: RtpParameters
) {
  let codecInfo: {
    payloadType: number
    codecName: string
    clockRate: number
    channels: number
  } = {
    payloadType: 0,
    codecName: '',
    clockRate: 0,
    channels: 0,
  }

  // Find the first codec of matching kind
  const codec = rtpParameters.codecs.find((c) =>
    kind === 'audio'
      ? c.mimeType.toLowerCase().includes('audio')
      : c.mimeType.toLowerCase().includes('video')
  )

  if (!codec) {
    throw new Error(`No ${kind} codec found`)
  }

  codecInfo.payloadType = codec.payloadType
  codecInfo.codecName = codec.mimeType.split('/')[1].toLowerCase()
  codecInfo.clockRate = codec.clockRate

  if (kind === 'audio') {
    codecInfo.channels = codec.channels || 2
  }

  return codecInfo
}

// Release a port with proper cleanup
export function releasePort(port: number) {
  const portInfo = usedPorts.get(port)
  if (!portInfo) return

  // Clear any existing release timer
  if (portInfo.releaseTimer) {
    clearTimeout(portInfo.releaseTimer)
  }

  // Set a new release timer
  const releaseTimer = setTimeout(() => {
    usedPorts.delete(port)
    console.log(`Released port ${port}`)
  }, PORT_RELEASE_DELAY)

  // Mark port as preparing for release
  usedPorts.set(port, {
    inUse: true,
    releaseTimer: releaseTimer as NodeJS.Timeout,
  })
  console.log(`Marked port ${port} for release`)
}
