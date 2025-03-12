import type { roomStateType } from '../types/types'

export const roomState: roomStateType = {
  // external
  peers: {},
  activeSpeaker: { producerId: null, volume: null, peerId: null },
  // internal
  transports: {},
  producers: [],
  consumers: [],
}
