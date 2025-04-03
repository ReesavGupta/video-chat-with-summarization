import { Consumer } from 'mediasoup-client/lib/Consumer'
import { useEffect, useRef } from 'react'

export function RemoteVideo({ consumer }: { consumer: Consumer }) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    if (videoRef.current && consumer && consumer.track) {
      videoRef.current.srcObject = new MediaStream([consumer.track.clone()])
      videoRef.current.play().catch((e) => console.error(e))
    }
    return () => {
      if (videoRef.current) {
        videoRef.current.srcObject = null
      }
    }
  }, [consumer])

  return (
    <div>
      <video
        className="border border-red-600"
        ref={videoRef}
        playsInline
      ></video>
    </div>
  )
}

export function RemoteAudio({ consumer }: { consumer: Consumer }) {
  const audioRef = useRef<HTMLAudioElement>(null)

  useEffect(() => {
    if (audioRef.current && consumer && consumer.track) {
      audioRef.current.srcObject = new MediaStream([consumer.track.clone()])
      audioRef.current.play().catch((e) => console.error(e))
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.srcObject = null
      }
    }
  }, [consumer])

  return (
    <audio
      muted={false}
      ref={audioRef}
    />
  )
}
