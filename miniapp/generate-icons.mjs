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
    description: 'Minecraft style pixel art item icon. Two crossed swords making an X. Each sword has chunky square pixels. Bright neon green blade pixels. Gold square guard pixels where swords cross. Red pixel gem at center. Gray pixel hilts at tips. Transparent background. 16x16 pixel grid, each pixel is a large visible square block.',
  },
  {
    name: 'newdeal',
    description: 'Minecraft style pixel art item icon. Two hands shaking in a handshake, viewed from front. Chunky square pixels. Skin tone pixels for hands. Green pixel cuff on left arm, blue pixel cuff on right arm. White sparkle pixel above. Transparent background. 16x16 pixel grid, each pixel is a large visible square block.',
  },
  {
    name: 'live',
    description: 'Minecraft style pixel art item icon. Antenna tower with signal waves. Chunky square pixels. Gray pixel vertical pole in center. Gray pixel wide base at bottom. Three curved arcs of pixels going outward from top: green inner, blue middle, light blue outer. Red pixel dot at antenna tip. Transparent background. 16x16 pixel grid, each pixel is a large visible square block.',
  },
  {
    name: 'jobs',
    description: 'Minecraft style pixel art item icon. Briefcase viewed from front. Chunky square pixels. Dark navy blue pixel rectangle body. Lighter blue pixel arch handle on top. Gold pixel horizontal line across middle. Gold pixel small clasp at center. Dark right edge for 3D depth. Transparent background. 16x16 pixel grid, each pixel is a large visible square block.',
  },
  {
    name: 'freelancers',
    description: 'Minecraft style pixel art item icon. Two person silhouettes side by side. Chunky square pixels. Front person: brown pixel hair, skin pixel face, blue pixel shirt. Back person offset left: purple pixel silhouette. Classic blocky head and shoulder shape like Minecraft character. Transparent background. 16x16 pixel grid, each pixel is a large visible square block.',
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
      image_size: { width: 32, height: 32 },
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
