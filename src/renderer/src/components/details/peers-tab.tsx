import type { PeerType } from '@shared/schemas'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { Details } from '@/hooks/use-details'
import { formatPercent, formatSpeed } from '@/lib/format'

const peerTypeLabels = {
  tcpIncoming: 'TCP in',
  tcpOutgoing: 'TCP out',
  utp: 'uTP',
  webrtc: 'WebRTC',
  webSeed: 'Web seed',
} as const satisfies Record<PeerType, string>

export const PeersTab = ({ peers }: { readonly peers: Details['peers'] }) => {
  if (peers.length === 0) return <p className="p-4 text-sm text-muted-foreground">No connected peers.</p>
  return (
    <Table className="table-fixed" containerClassName="h-full overflow-auto">
      <TableHeader className="sticky top-0 z-10 bg-background">
        <TableRow className="hover:bg-transparent">
          <TableHead className="h-8">Address</TableHead>
          <TableHead className="h-8">Client</TableHead>
          <TableHead className="h-8 w-20">Type</TableHead>
          <TableHead className="h-8 w-20 text-right">Progress</TableHead>
          <TableHead className="h-8 w-24 text-right">Down</TableHead>
          <TableHead className="h-8 w-24 text-right">Up</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {peers.map((peer) => (
          <TableRow key={peer.id}>
            <TableCell className="truncate py-1 font-mono text-xs">{peer.address}</TableCell>
            <TableCell className="truncate py-1">{peer.client}</TableCell>
            <TableCell className="py-1">{peerTypeLabels[peer.type]}</TableCell>
            <TableCell className="py-1 text-right tabular-nums">{formatPercent(peer.progress)}</TableCell>
            <TableCell className="py-1 text-right tabular-nums">{formatSpeed(peer.downloadSpeed)}</TableCell>
            <TableCell className="py-1 text-right tabular-nums">{formatSpeed(peer.uploadSpeed)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
