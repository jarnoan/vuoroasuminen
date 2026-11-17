// Generates the app icons from one SVG design.
// Run: node scripts/generate-icons.mjs
import sharp from "sharp"
import { writeFileSync } from "node:fs"

const ISI = "#2b59d9"
const AITI = "#c2571b"
const INK = "#14161a"

// Two arrows chasing each other around a house: the children's home alternates.
const mark = `
  <path d="M115 204.7 A150 150 0 0 1 370.9 159.6" fill="none" stroke="${ISI}" stroke-width="56" stroke-linecap="round"/>
  <path d="M326.6 192.4 L408.3 118.8 L404.5 235.1 Z" fill="${ISI}" stroke="${ISI}" stroke-width="10" stroke-linejoin="round"/>
  <path d="M397 307.3 A150 150 0 0 1 141.1 352.4" fill="none" stroke="${AITI}" stroke-width="56" stroke-linecap="round"/>
  <path d="M185.4 319.6 L103.7 393.2 L107.5 276.9 Z" fill="${AITI}" stroke="${AITI}" stroke-width="10" stroke-linejoin="round"/>
  <path d="M256 194 L318 250 L302 250 L302 314 L210 314 L210 250 L194 250 Z" fill="${INK}" stroke="${INK}" stroke-width="12" stroke-linejoin="round"/>`

const svg = ({ radius, scale }) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="${radius}" fill="#ffffff"/>
  <g transform="translate(256 256) scale(${scale}) translate(-256 -256)">${mark}
  </g>
</svg>
`

const rounded = svg({ radius: 112, scale: 1 })
const maskable = svg({ radius: 0, scale: 0.8 }) // keep the mark inside Android's safe zone
const square = svg({ radius: 0, scale: 0.9 }) // iOS rounds the corners itself

const png = (src, size) => sharp(Buffer.from(src)).resize(size, size).png().toBuffer()

writeFileSync("src/app/icon.svg", rounded)
// The mark alone, tightly cropped, for the in-app header logo
writeFileSync(
  "public/logo.svg",
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="72 72 368 368">${mark}\n</svg>\n`,
)
writeFileSync("src/app/apple-icon.png", await png(square, 180))
writeFileSync("public/icons/icon-192.png", await png(rounded, 192))
writeFileSync("public/icons/icon-512.png", await png(rounded, 512))
writeFileSync("public/icons/maskable-192.png", await png(maskable, 192))
writeFileSync("public/icons/maskable-512.png", await png(maskable, 512))

// favicon.ico with embedded PNGs (16, 32, 48)
const sizes = [16, 32, 48]
const images = await Promise.all(sizes.map((s) => png(rounded, s)))
const header = Buffer.alloc(6 + 16 * sizes.length)
header.writeUInt16LE(0, 0)
header.writeUInt16LE(1, 2)
header.writeUInt16LE(sizes.length, 4)
let offset = header.length
sizes.forEach((s, i) => {
  const e = 6 + 16 * i
  header.writeUInt8(s, e)
  header.writeUInt8(s, e + 1)
  header.writeUInt16LE(1, e + 4) // color planes
  header.writeUInt16LE(32, e + 6) // bits per pixel
  header.writeUInt32LE(images[i].length, e + 8)
  header.writeUInt32LE(offset, e + 12)
  offset += images[i].length
})
writeFileSync("src/app/favicon.ico", Buffer.concat([header, ...images]))
console.log("icons written")
