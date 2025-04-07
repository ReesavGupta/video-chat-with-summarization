import { Consumer } from 'mediasoup-client/lib/Consumer'
import { useState } from 'react'
import { peersType } from '../types'

export default function TrackControl({
  peers,
  peerName,
  mediaTag,
  mediaInfo,
  myPeerId,
  createTransport,
  consumer,
  onSubscribe,
  onUnsubscribe,
  onPauseConsumer,
  onResumeConsumer,
}: {
  peers: peersType
  peerName: string
  mediaTag: string
  mediaInfo: { paused: boolean }
  myPeerId: string
  createTransport: (direction: string) => void
  consumer: Consumer | undefined
  onSubscribe: (peerId: string, mediaTag: string) => void
  onUnsubscribe: (peerId: string, mediaTag: string) => void
  onPauseConsumer: (consumer: Consumer) => void
  onResumeConsumer: (consumer: Consumer) => void
}) {
  const peerId = peerName === 'my' ? myPeerId : peerName

  // const consumer = findConsumerForTrack(peerId, mediaTag)

  // const [isChecked, setIsChecked] = useState(
  //   consumer ? !consumer.paused : false
  // )

  // const toggleConsumer = async () => {
  //   if (consumer) {
  //     if (isChecked) {
  //       await pauseConsumer()
  //     } else {
  //       await resumeConsumer()
  //     }
  //     setIsChecked(!isChecked)
  //   }
  // }

  // function handleSubscribe(peerId: string, mediaTag: string) {
  //   console.log(`we are subscribing:`, peerId, mediaTag)

  //   if (!recvTransport) {
  //     createTransport('recv')
  //   }
  // }

  return (
    <div
    // className={`track-subscribe track-subscribe-${peerId} ${
    //   currentActiveSpeaker?.peerId === peerId ? 'active-speaker' : ''
    // }`}
    >
      {!consumer ? (
        <button
          onClick={() => onSubscribe(peerId, mediaTag)}
          className="m-3"
        >
          subscribe
        </button>
      ) : (
        <button
          onClick={() => onUnsubscribe(peerId, mediaTag)}
          className="m-3"
        >
          unsubscribe
        </button>
      )}

      <span className="bg-amber-500">
        {peerName} ----- {mediaTag}
      </span>

      {mediaInfo && (
        <span>
          {mediaInfo.paused ? '[producer paused]' : '[producer playing]'}
        </span>
      )}

      {consumer && (
        <>
          <span className="flex flex-wrap border-amber-400">
            <div>
              <input
                type="checkbox"
                checked={!consumer.paused}
                onChange={(e) => {
                  e.target.checked
                    ? onResumeConsumer(consumer)
                    : onPauseConsumer(consumer)
                }}
              />
              <label id={`consumer-stats-${consumer.id}`}>
                {consumer.paused
                  ? '[consumer paused]'
                  : `[consumer playing ${Math.floor(
                      (peers[myPeerId]?.stats?.[consumer.id]?.bitrate || 0) /
                        1000
                    )} kb/s]`}
              </label>
            </div>
          </span>

          {/* {consumer.kind === 'video' && (
            <ProducerTrackSelector
              consumer={consumer}
              peerId={peerId}
              producerId={consumer.producerId}
              stats={peers[myPeerId]?.stats || {}}
              consumerLayers={peers[myPeerId]?.consumerLayers || {}}
            />
          )} */}
        </>
      )}
    </div>
  )
}
