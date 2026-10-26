// Generates one narration clip per scene with ElevenLabs, plus word timings for the captions.
// Writes public/voice/<scene>.mp3 and public/voice/timings.json. Run with `npm run voice`.
import { mkdir, writeFile } from 'node:fs/promises';
import { script } from '../src/script.ts';

const key = process.env.ELEVENLABS_API_KEY;
const voice = process.env.ELEVENLABS_VOICE_ID || 'nPczCjzI2devNBz1zQrb'; // "Brian", a premade narration voice
if (!key) {
  console.error('Set ELEVENLABS_API_KEY in video/.env first (see .env.example).');
  process.exit(1);
}

const out = new URL('../public/voice/', import.meta.url);
await mkdir(out, { recursive: true });

/** Groups the character timings into words, and spoken IDs ("U zero zero one") back into "U001". */
function words({ characters, character_start_times_seconds: s, character_end_times_seconds: e }) {
  const list = [];
  let cur = null;
  characters.forEach((ch, i) => {
    if (/\s/.test(ch)) {
      cur = null;
      return;
    }
    if (!cur) list.push((cur = { text: '', start: s[i], end: e[i] }));
    cur.text += ch;
    cur.end = e[i];
  });
  const digits = { zero: '0', one: '1', two: '2', three: '3', four: '4', five: '5' };
  for (let i = 0; i < list.length; i++) {
    if (list[i].text !== 'U') continue;
    let j = i + 1;
    let id = 'U';
    while (j < list.length && digits[list[j].text.replace(/[,.]/g, '')] !== undefined) {
      id += digits[list[j].text.replace(/[,.]/g, '')];
      j++;
    }
    if (j > i + 1) {
      const punct = list[j - 1].text.match(/[,.]$/)?.[0] ?? '';
      list.splice(i, j - i, { text: id + punct, start: list[i].start, end: list[j - 1].end });
    }
  }
  return list;
}

const timings = {};
for (const [i, scene] of script.entries()) {
  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voice}/with-timestamps?output_format=mp3_44100_128`,
    {
      method: 'POST',
      headers: { 'xi-api-key': key, 'content-type': 'application/json' },
      body: JSON.stringify({
        text: scene.text,
        model_id: 'eleven_multilingual_v2',
        // Neighbouring lines keep the delivery consistent across separately generated clips.
        previous_text: script[i - 1]?.text,
        next_text: script[i + 1]?.text,
        voice_settings: { stability: 0.5, similarity_boost: 0.8, style: 0.15, use_speaker_boost: true },
      }),
    },
  );
  if (!res.ok) {
    console.error(`ElevenLabs refused "${scene.id}": ${res.status} ${await res.text()}`);
    process.exit(1);
  }
  const body = await res.json();
  await writeFile(new URL(`${scene.id}.mp3`, out), Buffer.from(body.audio_base64, 'base64'));
  const w = words(body.alignment);
  timings[scene.id] = { duration: w.at(-1).end, words: w };
  console.log(`${scene.id}: ${w.at(-1).end.toFixed(1)}s`);
}
await writeFile(new URL('timings.json', out), JSON.stringify(timings, null, 2));
console.log(
  'Done. Total',
  Object.values(timings)
    .reduce((t, x) => t + x.duration, 0)
    .toFixed(1) + 's',
);
