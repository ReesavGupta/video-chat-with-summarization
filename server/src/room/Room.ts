import type { Router } from 'mediasoup/node/lib/RouterTypes'
import type {
  AudioLevelObserver,
  AudioLevelObserverVolume,
} from 'mediasoup/node/lib/AudioLevelObserverTypes'

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
    this.peers[peerId] = {
      peerId,
      joinTs: Date.now(),
      lastSeenTs: Date.now(),
      media: {},
      stats: { producers: {}, consumers: {} },
      consumerLayers: {},
    }
  }
}
