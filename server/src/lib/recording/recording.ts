import type { Producer } from 'mediasoup/node/lib/types'
import type { Room } from '../../room/Room'
import { setUpRecordingForProducer } from './setupRecording'

export async function startRecording(room: Room) {
  // console.log(`this is our room : `, room)
  const roomProducerValues: Producer[] = Object.values(room.producers)
  for (let i = 0; i < roomProducerValues.length; i++) {
    const currProducer = roomProducerValues[i]

    if (currProducer.kind !== 'audio') {
      continue
    }
    try {
      const recordingInfo = await setUpRecordingForProducer(currProducer)

      if (!recordingInfo) {
        console.error('no recording info for producer: ', currProducer)
        return
      }
    } catch (error) {
      console.error(
        'something went wrong while starting the recording : ',
        error
      )
    }
  }
}
