// generate-icons.mjs
// Generates all 5 Home NavCard icons via Pixellab.ai API
// Run: node generate-icons.mjs

import fs from 'fs';
import path from 'path';

const API_KEY = 'f93f4d04-4449-4b99-8aee-df0651ac9992';
const BASE_URL = 'https://api.pixellab.ai/v1';
const OUT_DIR = './src/assets/icons';

const ICONS = [
  {
    name: 'deals',
    description: 'Two crossed swords forming an X shape. Bright green blades with white shine highlight. Gold crossguard where blades meet. Small red ruby gem at the center of the crossguard. Gray steel hilts at bottom of each sword. Black transparent background.',
  },
  {
    name: 'newdeal',
    description: 'A handshake from the front view. Two hands clasped together in the center. Left sleeve cuff is green, right sleeve cuff is blue. Small white sparkle pixels above the handshake. Skin tone hands. Black transparent background.',
  },
  {
    name: 'live',
    description: 'Broadcast antenna tower. Vertical gray pole centered. Wide gray base stand at bottom. Three pairs of signal arcs radiating outward from antenna top: inner arc green, middle arc blue, outer arc light blue. Small red dot at the very tip of the antenna. Black transparent background.',
  },
  {
    name: 'jobs',
    description: 'Classic briefcase front view. Dark navy blue rectangular body. Light blue handle arch on top center. Gold horizontal divider line across the middle. Small gold latch clasp at center of divider. Subtle 3D depth on right side darker. Black transparent background.',
  },
  {
    name: 'freelancers',
    description: 'Two person silhouettes. Front person larger and centered: round head with dark hair, skin tone face, blue shirt shoulders. Back person smaller offset to the upper left: full purple silhouette at lower opacity suggesting depth. Both use classic rounded head plus shoulder shape. Black transparent background.',
  },
];

async function generateIcon(icon) {
  const res = await fetch(`${BASE_URL}/generate-image-pixflux`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      description: icon.description,
      image_size: { width: 48, height: 48 },
      text_guidance_scale: 10,
      no_background: true,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`${icon.name}: HTTP ${res.status} — ${err}`);
  }

  const data = await res.json();
  return data.image?.url ?? data.image; // base64 or url depending on response
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  for (const icon of ICONS) {
    process.stdout.write(`Generating ${icon.name}... `);
    try {
      const result = await generateIcon(icon);

      let buffer;
      if (typeof result === 'string' && result.startsWith('http')) {
        // URL — download it
        const imgRes = await fetch(result);
        buffer = Buffer.from(await imgRes.arrayBuffer());
      } else if (typeof result === 'string') {
        // base64
        buffer = Buffer.from(result, 'base64');
      } else if (result?.base64) {
        buffer = Buffer.from(result.base64, 'base64');
      } else {
        throw new Error('Unknown response format: ' + JSON.stringify(result));
      }

      const outPath = path.join(OUT_DIR, `${icon.name}.png`);
      fs.writeFileSync(outPath, buffer);
      console.log(`✓ saved → ${outPath}`);
    } catch (e) {
      console.log(`✗ FAILED: ${e.message}`);
    }
  }

  console.log('\nDone. Check miniapp/src/assets/icons/');
}

main();
