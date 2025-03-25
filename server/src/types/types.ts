import type {
  MediaKind,
  RtpParameters,
} from 'mediasoup/node/lib/rtpParametersTypes'
import type { AppData } from 'mediasoup/node/lib/types'

export type roomStateType = {
  // external
  peers: {}
  activeSpeaker: {
    producerId: null | string
    volume: null | number
    peerId: null | string
  }
  // internal
  transports: {}
  producers: []
  consumers: []
}

export type HandleSendTrackMessageType = {
  type: string
  transportId: string
  roomId: string
  peerId: string
  kind: MediaKind
  rtpParameters: RtpParameters
  appData: AppData
  paused: boolean
}
