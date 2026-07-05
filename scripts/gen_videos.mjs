#!/usr/bin/env node
/**
 * Pre-generate the cached demo story clips (per IMPLEMENTATION_PLAN.md, live
 * Seedance generation is OFF the demo critical path — these cached clips in
 * /public/videos are the deliverable). Ken Burns pan over the real product
 * photo + storybook caption overlays, ending on a cliffhanger.
 *
 * Text is rendered to PNG via sharp (this ffmpeg build lacks drawtext),
 * then composited with ffmpeg overlay/xfade.
 */
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const root = path.resolve(import.meta.dirname, "..");
const OUT = path.join(root, "public/videos");
const TMP = path.join(root, ".video-tmp");
mkdirSync(OUT, { recursive: true });
mkdirSync(TMP, { recursive: true });

const dolls = ["wren", "paloma", "luke", "gwen", "levi", "alex", "grady", "mia", "chloe"];
const cap = (s) => s[0].toUpperCase() + s.slice(1);

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

function captionSvg(text, size = 28) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="720">
    <rect x="0" y="588" width="720" height="72" fill="black" fill-opacity="0.38"/>
    <text x="360" y="634" text-anchor="middle" font-family="Georgia, serif"
      font-size="${size}" fill="#FBF8F2">${esc(text)}</text>
  </svg>`;
}

function endcardSvg(bg, title, subtitle) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="720">
    <rect width="720" height="720" fill="${bg}"/>
    <text x="360" y="330" text-anchor="middle" font-family="Georgia, serif"
      font-weight="bold" font-size="44" fill="#F6F1E7">${esc(title)}</text>
    <text x="360" y="400" text-anchor="middle" font-family="Georgia, serif"
      font-size="23" fill="#F6F1E7" fill-opacity="0.85">${esc(subtitle)}</text>
    <text x="360" y="600" text-anchor="middle" font-family="Georgia, serif"
      font-style="italic" font-size="20" fill="#F6F1E7" fill-opacity="0.6">Apple Park</text>
  </svg>`;
}

async function png(name, svg) {
  const p = path.join(TMP, name);
  writeFileSync(p, await sharp(Buffer.from(svg)).png().toBuffer());
  return p;
}

function imgFor(id) {
  for (const ext of ["png", "jpg"]) {
    const p = path.join(root, "public/dolls", `${id}.${ext}`);
    if (existsSync(p)) return p;
  }
  throw new Error(`no image for ${id}`);
}

const KEN_BURNS_IN =
  "scale=720:720:force_original_aspect_ratio=increase,crop=720:720," +
  "zoompan=z='min(zoom+0.0009,1.18)':d=1:x='iw/2-(iw/zoom/2)':y='ih/3-(ih/zoom/3)':s=720x720:fps=25";
const KEN_BURNS_OUT =
  "scale=720:720:force_original_aspect_ratio=increase,crop=720:720," +
  "zoompan=z='if(lte(on,1),1.18,max(1.0,zoom-0.0011))':d=1:x='iw/2-(iw/zoom/2)':y='ih/3-(ih/zoom/3)':s=720x720:fps=25";

function renderClip({ img, kenBurns, photoDur, cap1, cap2, endcard, endDur, xfadeAt, out }) {
  const cap2Input = cap2 ? `-loop 1 -t ${photoDur} -framerate 25 -i "${cap2}"` : "";
  const endIdx = cap2 ? 3 : 2;
  const overlay2 = cap2
    ? `[a][2:v]overlay=0:0:enable='between(t,3.8,${photoDur - 0.2})'[b];`
    : "";
  const preEnd = cap2 ? "[b]" : "[a]";
  const cmd = `ffmpeg -y -loglevel error \
    -loop 1 -t ${photoDur} -i "${img}" \
    -loop 1 -t ${photoDur} -framerate 25 -i "${cap1}" \
    ${cap2Input} \
    -loop 1 -t ${endDur} -framerate 25 -i "${endcard}" \
    -filter_complex "
      [0:v]${kenBurns}[base];
      [base][1:v]overlay=0:0:enable='between(t,0.6,3.2)'[a];
      ${overlay2}
      ${preEnd}fade=t=in:st=0:d=0.6,format=yuv420p,fps=25[v0];
      [${endIdx}:v]format=yuv420p,fps=25[v1];
      [v0][v1]xfade=transition=fade:duration=0.8:offset=${xfadeAt}[v]" \
    -map "[v]" -c:v libx264 -preset veryfast -crf 24 -movflags +faststart -an "${out}"`;
  execSync(cmd, { stdio: ["ignore", "inherit", "inherit"] });
}

for (const id of dolls) {
  const Name = cap(id);
  const img = imgFor(id);

  // Chapter One (~10.5s, cliffhanger ending)
  renderClip({
    img,
    kenBurns: KEN_BURNS_IN,
    photoDur: 7,
    cap1: await png(`${id}-c1.png`, captionSvg("Chapter One", 32)),
    cap2: await png(`${id}-c2.png`, captionSvg(`${Name} is waiting for someone special...`)),
    endcard: await png(
      `${id}-end.png`,
      endcardSvg("#3f4a37", "To be continued...", `Bring ${Name} home to see what happens next`)
    ),
    endDur: 4,
    xfadeAt: 6.4,
    out: path.join(OUT, `${id}.mp4`),
  });
  console.log(`made ${id}.mp4`);

  // Chapter Two — post-QR unlock (~8.5s)
  renderClip({
    img,
    kenBurns: KEN_BURNS_OUT,
    photoDur: 5,
    cap1: await png(`${id}-c3.png`, captionSvg("Chapter Two", 32)),
    cap2: null,
    endcard: await png(
      `${id}-end2.png`,
      endcardSvg("#5C6B50", "...and best friends at last.", "The End (for now). A new friend means a new chapter.")
    ),
    endDur: 4,
    xfadeAt: 4.4,
    out: path.join(OUT, `${id}-full.mp4`),
  });
  console.log(`made ${id}-full.mp4`);
}

rmSync(TMP, { recursive: true, force: true });
console.log("done");
