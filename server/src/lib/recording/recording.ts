import type { Producer } from 'mediasoup/node/lib/types'
import type { Room } from '../../room/Room'
import { setUpRecordingForProducer } from './setupRecording'

export function startRecording(room: Room) {
  console.log(`this is our room : `, room)

  console.log(
    `\n\n\n\nthis is all of my producers:  `,
    room.producers,
    '\n\n\n\n'
  )
  const roomProducerValues: Producer[] = Object.values(room.producers)
  for (let i = 0; i < roomProducerValues.length; i++) {
    const currProducer = roomProducerValues[i]

    if (currProducer.kind !== 'audio') {
      continue
    }

    const recordingInfo = await setUpRecordingForProducer(currProducer)
  }
}
