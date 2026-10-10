import test from 'node:test';
import assert from 'node:assert/strict';
import { tunnelUrl } from '../lib/tunnel.js';
test('Cloudflare service failure cannot become the Mini App launch address',()=>{
  assert.equal(tunnelUrl('Failed request: https://api.trycloudflare.com/tunnel'),null);
  assert.equal(tunnelUrl('https://api.trycloudflare.com/tunnel\nVisit https://example-gift-radar.trycloudflare.com'), 'https://example-gift-radar.trycloudflare.com');
  assert.equal(tunnelUrl('ordinary logs without a URL'),null);
});
