import { useState } from 'react'

export default function TrackControl({
  peerName,
  mediaTag,
  mediaInfo,
  myPeerId,
}: {
  peerName: string
  mediaTag: string
  mediaInfo: {}
  myPeerId: string
}) {
  const peerId = peerName === 'my' ? myPeerId : peerName

  const consumer = findConsumerForTrack(peerId, mediaTag)

  const [isChecked, setIsChecked] = useState(
    consumer ? !consumer.paused : false
  )

  const toggleConsumer = async () => {
    if (consumer) {
      if (isChecked) {
        await pauseConsumer()
      } else {
        await resumeConsumer()
      }
      setIsChecked(!isChecked)
    }
  }

  return (
    <div className={`track-subscribe track-subscribe-${peerId}`}>
      <button
        onClick={() =>
          consumer
            ? handleUnsubscribe(peerId, mediaTag)
            : handleSubscribe(peerId, mediaTag)
        }
      >
        {consumer ? 'Unsubscribe' : 'Subscribe'}
      </button>

      <span>{`${peerName} ${mediaTag}`}</span>

      {mediaInfo && (
        <span>
          {mediaInfo.paused ? '[producer paused]' : '[producer playing]'}
        </span>
      )}

      {consumer && (
        <span className="nowrap">
          <input
            type="checkbox"
            checked={isChecked}
            onChange={toggleConsumer}
          />
          <label id={`consumer-stats-${consumer.id}`}>
            {consumer.paused
              ? '[consumer paused]'
              : `[consumer playing ${Math.floor(
                  (lastPollSyncData[myPeerId]?.stats[consumer.id]?.bitrate ||
                    0) / 1000
                )} kb/s]`}
          </label>
        </span>
      )}

      {consumer?.kind === 'video' && (
        <span
          className="nowrap track-ctrl"
          id={`track-ctrl-${consumer.producerId}`}
        />
      )}
    </div>
  )
}
