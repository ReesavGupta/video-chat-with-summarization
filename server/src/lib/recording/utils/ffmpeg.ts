import type { PlainTransport, Producer } from 'mediasoup/types'
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

  // const ffmpeg = spawn('ffmpeg', [
  //   '-loglevel',
  //   'debug',
  //   '-protocol_whitelist',
  //   'file,udp,rtp',
  //   '-i',
  //   sdpFilePath,
  //   '-acodec',
  //   'libmp3lame',
  //   '-b:a',
  //   '128k',
  //   '-ar',
  //   '48000',
  //   '-ac',
  //   '2',
  //   '-y',
  //   outputPath,
  // ])

  const ffmpeg = spawn(
    [
      'ffmpeg',
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
    ],
    {
      stdio: ['ignore', 'pipe', 'pipe'],
    }
  )

  // Improved error handling
  let startupCompleted = false

  const startupTimeout = setTimeout(() => {
    if (!startupCompleted) {
      console.error('FFmpeg startup timeout, process might be hanging')
      ffmpeg.kill('SIGKILL')
    }
  }, 10000) // 10 seconds startup timeout

  if (!ffmpeg.stderr) {
    return
  }

  const reader = ffmpeg.stderr.getReader()
  const decoder = new TextDecoder()
  async function readStderr() {
    if (!reader) return

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      const message = decoder.decode(value)

      if (message.includes('Output #0') || message.includes('encoder setup')) {
        startupCompleted = true
        clearTimeout(startupTimeout)
      }

      if (message.includes('bind failed') || message.includes('Error number')) {
        console.error(`FFmpeg binding error on port ${port}:`, message)
        ffmpeg.kill('SIGKILL')
      }

      if (message.toLowerCase().includes('error')) {
        console.error(`FFmpeg stderr: ${message}`)
      }
    }
  }

  readStderr().catch((err) => {
    console.error('Error reading FFmpeg stderr:', err)
  })

  ffmpeg.exited.then((code) => {
    clearTimeout(startupTimeout)
    console.log(`FFmpeg exited with code : ${code} `)
  })

  return ffmpeg
}
