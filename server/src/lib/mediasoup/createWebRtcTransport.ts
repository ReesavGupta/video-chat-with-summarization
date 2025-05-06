import type { Router } from 'mediasoup/node/lib/types'
import { config } from '../../config/conf'

export async function createWebRtcTransport(
  router: Router,
  direction: string,
  peerId: string
) {
  const { initialAvailableOutgoingBitrate, maxIncomeBitrate } =
    config.mediasoup.webRtcTransport
  const transport = await router.createWebRtcTransport({
    listenIps: config.mediasoup.webRtcTransport.listenIps,
    enableUdp: true,
    enableTcp: true,
    preferUdp: true,
    initialAvailableOutgoingBitrate,
    appData: { peerId, clientDirection: direction },
  })

  await transport.setMaxIncomingBitrate(maxIncomeBitrate)

  return {
    transport,
    params: {
      id: transport.id,
      iceParameters: transport.iceParameters,
      iceCandidates: transport.iceCandidates,
      dtlsParameters: transport.dtlsParameters,
    },
  }
}
