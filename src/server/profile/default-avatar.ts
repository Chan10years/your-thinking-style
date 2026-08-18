function hashSeed(seed: string): number {
  let hash = 0;
  for (const character of seed) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  }
  return hash;
}

function colorFromSeed(seed: string, offset: number): string {
  const value = (hashSeed(seed) + offset * 0x45d9f3b) & 0xffffff;
  return `#${value.toString(16).padStart(6, "0")}`;
}

export function createDefaultAvatarSvg(seed: string): string {
  const background = colorFromSeed(seed, 1);
  const foreground = colorFromSeed(seed, 2);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256"><rect width="256" height="256" rx="128" fill="${background}"/><circle cx="128" cy="96" r="45" fill="${foreground}"/><path d="M48 224c8-47 39-72 80-72s72 25 80 72" fill="${foreground}"/></svg>`;
}

export function createDefaultAvatarResponse(seed: string): Response {
  return new Response(createDefaultAvatarSvg(seed), {
    headers: {
      "content-type": "image/svg+xml; charset=utf-8",
      "cache-control": "private, max-age=3600",
    },
  });
}
