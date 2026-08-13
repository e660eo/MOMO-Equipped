import fs from "node:fs";
import path from "node:path";

const sampleRate = 22_050;
const tempo = 100;
const beat = 60 / tempo;
const bars = 8;
const duration = bars * 4 * beat;
const frames = Math.ceil(duration * sampleRate);
const channels = 2;
const data = new Int16Array(frames * channels);
let noiseState = 0x4d4f4d4f;

function noise() {
  noiseState = (1664525 * noiseState + 1013904223) >>> 0;
  return (noiseState / 0xffffffff) * 2 - 1;
}

function noteFrequency(midi) {
  return 440 * 2 ** ((midi - 69) / 12);
}

const roots = [45, 41, 48, 43]; // A2, F2, C3, G2
const chords = [
  [57, 60, 64],
  [53, 57, 60],
  [60, 64, 67],
  [55, 59, 62],
];
const arpSteps = [0, 1, 2, 1, 0, 2, 1, 2];

for (let frame = 0; frame < frames; frame++) {
  const time = frame / sampleRate;
  const beatPosition = time / beat;
  const beatIndex = Math.floor(beatPosition);
  const inBeat = beatPosition - beatIndex;
  const bar = Math.floor(beatIndex / 4);
  const chordIndex = Math.floor(bar / 2) % 4;
  const root = roots[chordIndex];
  let left = 0;
  let right = 0;

  // Басовая линия: корень и квинта чередуются каждые полтакта.
  const bassMidi = root - 12 + (Math.floor(beatPosition * 2) % 4 === 3 ? 7 : 0);
  const bassPhase = 2 * Math.PI * noteFrequency(bassMidi) * time;
  const bassEnv = Math.exp(-2.1 * (inBeat % 0.5));
  const bass = (Math.sin(bassPhase) + 0.28 * Math.sin(bassPhase * 2)) * bassEnv * 0.25;
  left += bass;
  right += bass;

  // Мягкие аккорды дают середину и стерео-картину.
  for (const [index, midi] of chords[chordIndex].entries()) {
    const frequency = noteFrequency(midi);
    const pan = index === 0 ? 0.75 : index === 2 ? 1.25 : 1;
    const pad = Math.sin(2 * Math.PI * frequency * time + index * 0.7) * 0.045;
    left += pad * (2 - pan);
    right += pad * pan;
  }

  // Высокочастотное арпеджио.
  const eighth = Math.floor(beatPosition * 2);
  const inEighth = beatPosition * 2 - eighth;
  const arpMidi = chords[chordIndex][arpSteps[eighth % arpSteps.length]] + 12;
  const arpEnv = Math.exp(-7 * inEighth);
  const arp = Math.sin(2 * Math.PI * noteFrequency(arpMidi) * time) * arpEnv * 0.10;
  left += arp * 1.15;
  right += arp * 0.85;

  // Бочка на каждую долю.
  const kickFrequency = 48 + 78 * Math.exp(-18 * inBeat);
  const kick = Math.sin(2 * Math.PI * kickFrequency * time) * Math.exp(-11 * inBeat) * 0.55;
  left += kick;
  right += kick;

  // Малый барабан на вторую и четвёртую доли.
  if (beatIndex % 4 === 1 || beatIndex % 4 === 3) {
    const snare = (noise() * 0.21 + Math.sin(2 * Math.PI * 185 * time) * 0.10) * Math.exp(-18 * inBeat);
    left += snare * 0.9;
    right += snare * 1.1;
  }

  // Хай-хэт на восьмые доли.
  const hat = (noise() - noise()) * Math.exp(-38 * inEighth) * 0.055;
  left += hat * 1.15;
  right += hat * 0.85;

  const fadeIn = Math.min(1, time / 0.4);
  const fadeOut = Math.min(1, (duration - time) / 1.2);
  const master = Math.max(0, Math.min(fadeIn, fadeOut));
  data[frame * 2] = Math.round(Math.tanh(left * 1.2) * master * 24_000);
  data[frame * 2 + 1] = Math.round(Math.tanh(right * 1.2) * master * 24_000);
}

const output = Buffer.alloc(44 + data.byteLength);
output.write("RIFF", 0);
output.writeUInt32LE(36 + data.byteLength, 4);
output.write("WAVE", 8);
output.write("fmt ", 12);
output.writeUInt32LE(16, 16);
output.writeUInt16LE(1, 20);
output.writeUInt16LE(channels, 22);
output.writeUInt32LE(sampleRate, 24);
output.writeUInt32LE(sampleRate * channels * 2, 28);
output.writeUInt16LE(channels * 2, 32);
output.writeUInt16LE(16, 34);
output.write("data", 36);
output.writeUInt32LE(data.byteLength, 40);
Buffer.from(data.buffer).copy(output, 44);

const target = path.join(process.cwd(), "public", "audio", "momo-reference-loop.wav");
fs.mkdirSync(path.dirname(target), { recursive: true });
fs.writeFileSync(target, output);
console.log(`Generated ${target} (${Math.round(output.length / 1024)} KB)`);
