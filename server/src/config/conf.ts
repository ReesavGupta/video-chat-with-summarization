import type {
  RtpCodecCapability,
  TransportListenInfo,
  WorkerLogTag,
} from 'mediasoup/node/lib/types'

const config = {
  mediasoup: {
    worker: {
      rtcMinPort: 40000,
      rtcMaxPort: 49999,
      logLevel: 'debug',
      logTags: [
        'info',
        'ice',
        'dtls',
        'rtp',
        'srtp',
        'rtcp',
        // 'rtx',
        // 'bwe',
        // 'score',
        // 'simulcast',
        // 'svc'
      ] as WorkerLogTag[],
    },
    router: {
      mediaCodecs: [
        {
          kind: 'audio',
          mimeType: 'audio/opus',
          clockRate: 48000,
          channels: 2,
        },
        {
          kind: 'video',
          mimeType: 'video/VP8',
          clockRate: 90000,
          parameters: {
            //                'x-google-start-bitrate': 1000
          },
        },
        {
          kind: 'video',
          mimeType: 'video/h264',
          clockRate: 90000,
          parameters: {
            'packetization-mode': 1,
            'profile-level-id': '4d0032',
            'level-asymmetry-allowed': 1,
            //						  'x-google-start-bitrate'  : 1000
          },
        },
        {
          kind: 'video',
          mimeType: 'video/h264',
          clockRate: 90000,
          parameters: {
            'packetization-mode': 1,
            'profile-level-id': '42e01f',
            'level-asymmetry-allowed': 1,
            //						  'x-google-start-bitrate'  : 1000
          },
        },
      ] as RtpCodecCapability[],
    },

    // rtp listenIps are the most important thing, below. we will need
    // to set these appropriately for our network for the app to
    // run anywhere but on localhost
    webRtcTransport: {
      listenIps: [
        { ip: '0.0.0.0', announcedIp: '127.0.0.1' },
        // { ip: "192.168.42.68", announcedIp: null },
        // { ip: '10.10.23.101', announcedIp: null },
      ] as TransportListenInfo[],
      initialAvailableOutgoingBitrate: 800000,
      // initialAvailableOutgoingBitrate: 1000000,  from mediasoup prac
      maxIncomeBitrate: 150000,
    },
  },
} as const

export { config }
