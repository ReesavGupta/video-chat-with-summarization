import { createWorker } from 'mediasoup'
import { config } from '../config/conf'
import { log } from 'console'
import type {
  AppData,
  AudioLevelObserver,
  AudioLevelObserverVolume,
  Router,
  Worker,
} from 'mediasoup/node/lib/types'
import { roomState } from '../room/roomState'

const createMediasoupWorkerAndRouter = async (): Promise<{
  router: Router<AppData>
  worker: Worker<AppData>
  audioLevelObserver: AudioLevelObserver<AppData>
} | void> => {
  try {
    const worker: Worker<AppData> = await createWorker({
      logLevel: config.mediasoup.worker.logLevel,
      logTags: config.mediasoup.worker.logTags,
    })

    worker.on('died', () => {
      console.error(
        'mediasoup worker died, exiting in 2 seconds ... [pid: &d]',
        worker.pid
      )
      setTimeout(() => {
        process.exit(1)
      }, 2000)
    })
    const mediaCodecs = config.mediasoup.router.mediaCodecs

    const router: Router<AppData> = await worker.createRouter({ mediaCodecs })

    const audioLevelObserver: AudioLevelObserver<AppData> =
      await router.createAudioLevelObserver({
        interval: 500,
      })

    audioLevelObserver.on('volumes', (volumes: AudioLevelObserverVolume[]) => {
      const { producer, volume } = volumes[0]
      log('audio-level volumes event: ')

      roomState.activeSpeaker.peerId = producer.id
      roomState.activeSpeaker.volume = volume
      roomState.activeSpeaker.peerId = producer.appData.peerId as string
    })
    audioLevelObserver.on('silence', () => {
      log('audio-level silence event')
      roomState.activeSpeaker.producerId = null
      roomState.activeSpeaker.volume = null
      roomState.activeSpeaker.peerId = null
    })
    return { router, worker, audioLevelObserver }
  } catch (error) {
    console.error('something went wrong: ', error)
    // exit if worker creation goes wrong
    setTimeout(() => {
      process.exit(1)
    }, 2000)
  }
}
export { createMediasoupWorkerAndRouter }
