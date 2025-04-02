import {
  AppData,
  DtlsParameters,
  IceCandidate,
  IceParameters,
  MediaKind,
  RtpParameters,
} from 'mediasoup-client/lib/types'

export type activeSpeakerType = {
  producerId: string | null
  volume: number | null
  peerId: string | null
}

export type peersType = Record<string, any>

export type createTransportMessageType = {
  type: string
  data: {
    transportOptions: {
      id: string
      iceParameters: IceParameters
      iceCandidates: IceCandidate[]
      dtlsParameters: DtlsParameters
    }
  }
}

export type handleConsumerCreatedType = {
  type: string
  producerId: string
  id: string
  kind: MediaKind
  rtpParameters: RtpParameters
  consumerType: string
  producerPaused: boolean
}
