import type { Router } from 'mediasoup/node/lib/RouterTypes'
import type {
  AudioLevelObserver,
  AudioLevelObserverVolume,
} from 'mediasoup/node/lib/AudioLevelObserverTypes'

// for each peer that connects, we keep a table of peers and what
// tracks are being sent and received. we also need to know the last
// time we saw the peer, so that we can disconnect clients that have
// network issues.

// [peerId] : {
//   joinTs: <ms timestamp>
//   lastSeenTs: <ms timestamp>
//   media: {
//     [mediaTag] : {
//       paused: <bool>
//       encodings: []
//     }
//   },
//   stats: {
//     producers: {
//       [producerId]: {
//         ...(selected producer stats)
//       }
//     consumers: {
//       [consumerId]: { ...(selected consumer stats) }
//     }
//   }
//   consumerLayers: {
//     [consumerId]:
//         currentLayer,
//         clientSelectedLayer,
//       }
//     }
//   }
// }
//
// we also send information about the active speaker, as tracked by
// our audioLevelObserver.
//
// internally, we keep lists of transports, producers, and
// consumers. whenever we create a transport, producer, or consumer,
// we save the remote peerId in the object's `appData`. for producers
// and consumers we also keep track of the client-side "media tag", to
// correlate tracks.
//

export class Room {
  public id: string

  public peers: Record<string, any> = {}

  public transports: Record<string, any> = {}

  public producers: Record<string, any> = {}

  public consumers: Record<string, any> = {}

  public activeSpeaker: {
    producerId: string | null
    volume: number | null
    peerId: string | null
  } = {
    producerId: null,
    volume: null,
    peerId: null,
  }
  public router: Router
  public audioLevelObserver?: AudioLevelObserver

  public roomOwner: string = ''

  constructor(id: string, router: Router) {
    this.router = router
    this.id = id
  }

  async init() {
    this.audioLevelObserver = await this.router.createAudioLevelObserver({
      interval: 500,
    })
    if (!this.audioLevelObserver) {
      console.log(`audio level observer couldnot be created :(`)
      return
    }
    this.audioLevelObserver.on(
      'volumes',
      (volumes: AudioLevelObserverVolume[]) => {
        const { producer, volume } = volumes[0]
        const peerId = producer.appData.peerId as string

        if (this.peers[peerId]) {
          this.activeSpeaker = { producerId: producer.id, volume, peerId }
        }
      }
    )
    this.audioLevelObserver.on('silence', () => {
      this.activeSpeaker = { producerId: null, volume: null, peerId: null }
    })
  }

  addPeer(peerId: string) {
    if (Object.keys(this.peers).length === 0) {
      this.roomOwner = peerId
    }
    this.peers[peerId] = {
      peerId,
      joinTs: Date.now(),
      lastSeenTs: Date.now(),
      media: {},
      stats: { producers: {}, consumers: {} },
      consumerLayers: {},
    }
  }

  removePeer(peerId: string) {
    // remove the peerId from peers
    // close its transport
  }
}
