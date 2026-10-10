export function tunnelUrl(log) {
  const urls = log.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com\b/g) || [];
  // Cloudflared errors may mention its service API; that is not our public URL.
  return urls.find(url => new URL(url).hostname !== 'api.trycloudflare.com') || null;
}
