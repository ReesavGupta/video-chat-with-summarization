import type { PlainTransport, Producer } from 'mediasoup/node/lib/types'
import { getCodecInfoFromRtpParameters } from '.'
import { spawn } from 'bun'

export function createSdpText(
  producer: Producer,
  plainTransport: PlainTransport,
  ffmpegPort: number
) {
  const { localIp } = plainTransport.tuple

  // Use a specific port for FFmpeg to receive on, different from the MediaSoup port
  const rtpPort = ffmpegPort

  // Get the actual payload type from the producer's parameters
  const audioCodecInfo = getCodecInfoFromRtpParameters(
    'audio',
    producer.rtpParameters
  )

  console.log(
    'Producer RTP parameters:',
    JSON.stringify(producer.rtpParameters, null, 2)
  )
  console.log('Using audio codec:', JSON.stringify(audioCodecInfo, null, 2))

  // Create SDP for audio only
  return `v=0
o=- 0 0 IN IP4 0.0.0.0
s=MediaSoup Recording
c=IN IP4 ${localIp}
t=0 0
m=audio ${rtpPort} RTP/AVP ${audioCodecInfo.payloadType}
a=rtpmap:${audioCodecInfo.payloadType} ${audioCodecInfo.codecName}/${audioCodecInfo.clockRate}/${audioCodecInfo.channels}
a=recvonly`
}

// Improved FFmpeg spawning with better error handling
export function spawnFFmpeg(
  sdpFilePath: string,
  outputPath: string,
  port: number
) {
  console.log(`Starting FFmpeg process to record from port ${port}`)

  const ffmpeg = spawn('ffmpeg', [
    '-loglevel',
    'debug',
    '-protocol_whitelist',
    'file,udp,rtp',
    '-i',
    sdpFilePath,
    '-acodec',
    'libmp3lame',
    '-b:a',
    '128k',
    '-ar',
    '48000',
    '-ac',
    '2',
    '-y',
    outputPath,
  ])

  // Improved error handling
  let startupCompleted = false
  const startupTimeout = setTimeout(() => {
    if (!startupCompleted) {
      console.error('FFmpeg startup timeout, process might be hanging')
      ffmpeg.kill('SIGKILL')
    }
  }, 10000) // 10 seconds startup timeout

  ffmpeg.stderr.on('data', (data) => {
    const message = data.toString()

    // Check for successful startup indicators
    if (message.includes('Output #0') || message.includes('encoder setup')) {
      startupCompleted = true
      clearTimeout(startupTimeout)
    }

    // Check for binding errors
    if (message.includes('bind failed') || message.includes('Error number')) {
      console.error(`FFmpeg port ${port} binding error: ${message}`)
      // Consider this a fatal error
      ffmpeg.kill('SIGKILL')
    }

    // Log only if debug enabled or error
    if (
      message.includes('Error') ||
      message.includes('error') ||
      process.env.DEBUG
    ) {
      console.error(`FFmpeg stderr: ${message}`)
    }
  })

  // Handle process termination
  ffmpeg.on('exit', (code, signal) => {
    clearTimeout(startupTimeout)
    console.log(`FFmpeg exited with code ${code}, signal ${signal}`)
  })

  return ffmpeg
}
