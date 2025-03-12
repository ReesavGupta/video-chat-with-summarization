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
