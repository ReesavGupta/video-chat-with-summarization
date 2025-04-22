import type {
  Consumer,
  PlainTransport,
  Producer,
} from 'mediasoup/node/lib/types'
import { router } from '../..'
import { spawn } from 'bun'
import {
  findAvailablePort,
  getCodecInfoFromRtpParameters,
  releasePort,
} from './utils'
import { createSdpText, spawnFFmpeg } from './utils/ffmpeg'

// Track active recordings by producer ID
const activeRecordings = new Map<
  string,
  {
    plainTransport: PlainTransport
    consumer: Consumer
    ffmpeg: ChildProcessWithoutNullStreams
    outputPath: string
    port: number
    cleanup: () => void
  }
>()

export const PORT_RANGE_START = 50000
export const PORT_RANGE_END = 51000
export const PORT_RELEASE_DELAY = 2000 // ms to wait before reusing a port

export async function setUpRecordingForProducer(producer: Producer) {
  const targetProducer = producer

  if (!targetProducer) {
    console.error('No producer available for recording.')
    return null
  }

  // Check if this producer is already being recorded
  if (activeRecordings.has(targetProducer.id)) {
    console.log(`Producer ${targetProducer.id} is already being recorded`)
    return activeRecordings.get(targetProducer.id)
  }

  // Create a unique ID for this recording session
  const sessionId = `${targetProducer.id}_${Date.now()}_${Math.floor(
    Math.random() * 1000
  )}`

  try {
    // Try multiple ports if necessary
    let ffmpegPort: number | undefined
    let attempts = 0
    const maxAttempts = 5

    while (attempts < maxAttempts) {
      try {
        ffmpegPort = await findAvailablePort(PORT_RANGE_START, PORT_RANGE_END)
        console.log(`this is the available port : ${ffmpegPort}`)
        break // If we get here, we found a port
      } catch (err) {
        attempts++
        console.warn(
          `Port finding attempt ${attempts} failed: ${(err as any).message}`
        )
        if (attempts >= maxAttempts) throw err
        await new Promise((r) => setTimeout(r, 200)) // Short delay before retry
      }
    }
    // console.log(`Found available port for FFmpeg: ${ffmpegPort}`)
    // @ts-ignore
    if (ffmpegPort !== undefined) {
      console.log(`Found available port for FFmpeg: ${ffmpegPort}`)
    }
    // Create a plain transport for MediaSoup
    const plainTransportPort = await findAvailablePort(
      PORT_RANGE_START,
      PORT_RANGE_END
    )
    const plainTransport = await router.createPlainTransport({
      listenIp: { ip: '127.0.0.1', announcedIp: '127.0.0.1' },
      rtcpMux: true, // Enable RTCP multiplexing to simplify setup
      port: plainTransportPort,
    })

    console.log(`Created plain transport: ${plainTransport.id}`)

    // Create a consumer to pipe the producer's audio to our plainTransport
    const consumer = await plainTransport.consume({
      producerId: targetProducer.id,
      rtpCapabilities: router.rtpCapabilities,
      paused: false,
    })

    console.log(
      'Consumer created with RTP parameters:',
      JSON.stringify(consumer.rtpParameters, null, 2)
    )

    // Connect the plainTransport to send RTP to the FFmpeg port
    await plainTransport.connect({
      ip: '127.0.0.1',
      port: ffmpegPort ?? -1, // Use a default value or handle undefined
    })

    console.log(
      `Connected plain transport to send RTP to 127.0.0.1:${ffmpegPort}`
    )

    // Create an SDP file for FFmpeg using our selected port and the ACTUAL consumer payload type
    const consumerCodecInfo = getCodecInfoFromRtpParameters(
      'audio',
      consumer.rtpParameters
    )

    // Override the producer's payload type with the consumer's payload type
    // This ensures the SDP matches what's actually being sent
    const producerCopy = {
      ...targetProducer,
      rtpParameters: { ...targetProducer.rtpParameters },
    }
    producerCopy.rtpParameters.codecs = [...targetProducer.rtpParameters.codecs] // Deep copy the codecs array
    producerCopy.rtpParameters.codecs[0] = {
      ...producerCopy.rtpParameters.codecs[0],
      payloadType: consumerCodecInfo.payloadType,
    }

    const sdpContent = createSdpText(
      producerCopy as Producer,
      plainTransport,
      ffmpegPort!
    )
    console.log('Generated SDP:', sdpContent)

    // Setup directories and files
    const outputDir = path.resolve(__dirname, '../../public/recordings')
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true })
    }

    // Create a unique filename
    const outputPath = path.join(outputDir, `recording_${sessionId}.mp3`)
    const sdpFilePath = path.join(os.tmpdir(), `recording_${sessionId}.sdp`)

    // Write SDP to file
    fs.writeFileSync(sdpFilePath, sdpContent)
    console.log(`SDP file written to ${sdpFilePath}`)

    // Give a short delay to ensure everything is setup
    await new Promise((resolve) => setTimeout(resolve, 1000))

    // Start FFmpeg with enhanced error handling
    const ffmpeg = spawnFFmpeg(sdpFilePath, outputPath, ffmpegPort!)

    // Set a timeout for the recording
    const ffmpegTimeout = setTimeout(() => {
      console.log('FFmpeg timeout reached, stopping recording')
      ffmpeg.kill('SIGINT')
    }, 10 * 60 * 1000) // 10 minutes

    // Setup cleanup function
    const cleanup = () => {
      clearTimeout(ffmpegTimeout)
      ffmpeg.kill('SIGINT')

      // Remove from active recordings
      activeRecordings.delete(targetProducer.id)

      // Close transport if not already closed
      if (plainTransport && !plainTransport.closed) {
        plainTransport.close()
      }

      // Release the port
      releasePort(ffmpegPort!)

      // Clean up SDP file
      try {
        if (fs.existsSync(sdpFilePath)) {
          fs.unlinkSync(sdpFilePath)
        }
      } catch (err) {
        console.error('Error deleting SDP file:', err)
      }
    }

    // Add exit handler
    ffmpeg.on('exit', (code, signal) => {
      // Try to check if the file was created successfully
      if (fs.existsSync(outputPath)) {
        const stats = fs.statSync(outputPath)
        console.log(`Output file size: ${stats.size} bytes`)
        if (stats.size === 0) {
          console.error('Output file is empty, recording failed')
          try {
            fs.unlinkSync(outputPath)
          } catch (err) {
            console.error('Error deleting empty output file:', err)
          }
        } else {
          console.log(`Recording saved to ${outputPath}`)
        }
      } else {
        console.error('Output file was not created')
      }

      // Clean up
      cleanup()
    })

    console.log(`Recording started for producer ${targetProducer.id}`)

    // Create recording info object
    const recordingInfo = {
      plainTransport,
      consumer,
      ffmpeg,
      outputPath,
      port: ffmpegPort!,
      cleanup,
    }

    // Store in active recordings map
    activeRecordings.set(targetProducer.id, recordingInfo)

    return recordingInfo
  } catch (error) {
    console.error('Error setting up recording:', error)

    // Make sure to clean up any allocated resources on error
    // if (ffmpegPort !== undefined) {
    //   releasePort(ffmpegPort)
    // }

    return null
  }
}
