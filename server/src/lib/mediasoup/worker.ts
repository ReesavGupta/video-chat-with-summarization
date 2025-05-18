import { createWorker } from 'mediasoup'
import { config } from '../../config/conf'
import type { AppData, Router, Worker } from 'mediasoup/node/lib/types'

const createMediasoupWorkerAndRouter = async (): Promise<{
  router: Router<AppData>
  worker: Worker<AppData>
} | void> => {
  try {
    const worker: Worker<AppData> = await createWorker({
      logLevel: config.mediasoup.worker.logLevel,
      logTags: config.mediasoup.worker.logTags,
    })

    console.log(`this is worker:`, worker)

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

    let router: Router<AppData>
    try {
      console.log(`before cration of router`)
      router = await worker.createRouter({ mediaCodecs })
      console.log(`router:`, router)
    } catch (err) {
      console.error('Failed to create router:', err)
      throw err // Re-throw to trigger the main catch
    }

    return { router, worker }
  } catch (error) {
    console.error('something went wrong: ', error)
    // exit if worker creation goes wrong
    setTimeout(() => {
      process.exit(1)
    }, 2000)
  }
}
export { createMediasoupWorkerAndRouter }
