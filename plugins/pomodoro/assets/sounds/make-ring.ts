// Generates pomodoro-ring.wav: a two-partial bell (880 + 1320 Hz) with an exponential decay.
// Synthesized here, so it is covered by the repo's MIT licence. Run: bun assets/sounds/make-ring.ts
const rate = 16000
const n = Math.floor(rate * 0.8)
const buf = Buffer.alloc(44 + n * 2)
buf.write('RIFF', 0)
buf.writeUInt32LE(36 + n * 2, 4)
buf.write('WAVEfmt ', 8)
buf.writeUInt32LE(16, 16)
buf.writeUInt16LE(1, 20) // PCM
buf.writeUInt16LE(1, 22) // mono
buf.writeUInt32LE(rate, 24)
buf.writeUInt32LE(rate * 2, 28)
buf.writeUInt16LE(2, 32)
buf.writeUInt16LE(16, 34)
buf.write('data', 36)
buf.writeUInt32LE(n * 2, 40)
for (let i = 0; i < n; i++) {
  const t = i / rate
  const s = (Math.sin(2 * Math.PI * 880 * t) + 0.5 * Math.sin(2 * Math.PI * 1320 * t)) * Math.exp(-5 * t) * Math.min(1, t * 400)
  buf.writeInt16LE(Math.round(s * 0.5 * 32767), 44 + i * 2)
}
await Bun.write(new URL('pomodoro-ring.wav', import.meta.url), buf)
