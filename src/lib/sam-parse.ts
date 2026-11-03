// Parse SAM 3.1 segmentation text output (boxes only) and derive observable facts.
import type { SegmentationBox } from "./types";

const RECORD = /(\d+)<\|box;x1=(\d+);y1=(\d+);x2=(\d+);y2=(\d+);w=(\d+);h=(\d+)(?:;c=([\d.]+))?\|>/g;

/** Reads the first frame's boxes from SAM's `<0f>id<|box;...|><|mask;...|>` output. */
export function parseSamBoxes(text: string): SegmentationBox[] {
  if (!text) return [];
  const firstLine = text.split("\n").find((l) => l.trim().length > 0) ?? "";
  const boxes: SegmentationBox[] = [];
  for (const m of firstLine.matchAll(RECORD)) {
    boxes.push({
      id: Number(m[1]),
      x1: Number(m[2]),
      y1: Number(m[3]),
      x2: Number(m[4]),
      y2: Number(m[5]),
      w: Number(m[6]),
      h: Number(m[7]),
      confidence: m[8] !== undefined ? Number(m[8]) : null,
    });
  }
  return boxes;
}

/** Plain-language observations limited to what boxes can show. */
export function describeSegmentation(
  structure: SegmentationBox[],
  load: SegmentationBox[],
  structurePrompt: string,
  loadPrompt: string | null,
): string[] {
  const out: string[] = [];
  if (structure.length === 0) {
    out.push(`No region matching “${structurePrompt}” was found in the photo.`);
  } else {
    const main = [...structure].sort(
      (a, b) => (b.x2 - b.x1) * (b.y2 - b.y1) - (a.x2 - a.x1) * (a.y2 - a.y1),
    )[0];
    const bw = main.x2 - main.x1;
    const bh = main.y2 - main.y1;
    const aspect = bw > 0 ? Math.round((bh / bw) * 10) / 10 : 0;
    const frameShare = Math.round(((bw * bh) / (main.w * main.h)) * 100);
    out.push(
      `Found ${structure.length} region${structure.length === 1 ? "" : "s"} matching “${structurePrompt}”.`,
    );
    out.push(
      `Largest region is ${aspect}× taller than it is wide and fills about ${frameShare}% of the frame.`,
    );
    if (loadPrompt) {
      if (load.length === 0) {
        out.push(`No region matching “${loadPrompt}” was found.`);
      } else {
        const onTop = load.some((l) => {
          const overlapX = Math.min(l.x2, main.x2) - Math.max(l.x1, main.x1);
          const nearTop = l.y2 >= main.y1 - bh * 0.15 && l.y2 <= main.y1 + bh * 0.35;
          return overlapX > 0 && nearTop;
        });
        out.push(
          onTop
            ? `A “${loadPrompt}” region sits at the top of the structure.`
            : `A “${loadPrompt}” region was found, but not positioned at the top of the structure.`,
        );
      }
    }
  }
  out.push("A photo cannot confirm weight, hold time, or strength — those come from your measurements.");
  return out;
}
