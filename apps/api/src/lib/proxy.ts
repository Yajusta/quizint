// Which X-Forwarded-For hop to believe. One rule for REST (Fastify's `trustProxy`) and the socket.io
// handshakes (`clientIp` in modules/live/socket-guards.ts), so both key their per-IP limits alike.

import { BlockList, isIP } from 'node:net';

// Loopback and private ranges: where Caddy reaches the API from (the compose network, or localhost).
const PRIVATE_PEERS = new BlockList();
PRIVATE_PEERS.addSubnet('127.0.0.0', 8, 'ipv4');
PRIVATE_PEERS.addSubnet('10.0.0.0', 8, 'ipv4');
PRIVATE_PEERS.addSubnet('172.16.0.0', 12, 'ipv4');
PRIVATE_PEERS.addSubnet('192.168.0.0', 16, 'ipv4');
PRIVATE_PEERS.addAddress('::1', 'ipv6');
PRIVATE_PEERS.addSubnet('fc00::', 7, 'ipv6');

/**
 * Trust function for X-Forwarded-For: exactly one hop, Caddy's. `hop` 0 is the socket peer, trusted
 * only when it is a private address (a directly exposed API port answers with the real peer instead
 * of believing the header); the next address — the right-most XFF entry, which Caddy writes itself —
 * is never trusted, so it becomes the client IP. A client-supplied X-Forwarded-For can therefore
 * never choose the IP its rate-limit bucket is keyed on.
 */
export function trustCaddyHop(address: string, hop: number): boolean {
  if (hop !== 0) return false;
  const ip = address.startsWith('::ffff:') ? address.slice('::ffff:'.length) : address;
  const family = isIP(ip);
  return family !== 0 && PRIVATE_PEERS.check(ip, family === 4 ? 'ipv4' : 'ipv6');
}
