// Browser-only: reads an uploaded résumé. DOCX → text (JSZip + XML). PDF → data URL for Muse Spark's
// native PDF input, plus its text layer (unpdf) so quotes can be checked against the real document.
import { RESUME_LIMITS } from "./resume-rules";

export interface ReadResume {
  kind: "pdf" | "docx";
  fileName: string;
  text: string;
  pdfDataUrl?: string;
}

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function fileToDataUrl(file: Blob): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = () => rej(new Error("Could not read the file"));
    r.readAsDataURL(file);
  });
}

async function docxText(buf: ArrayBuffer): Promise<string> {
  const { default: JSZip } = await import("jszip");
  const zip = await JSZip.loadAsync(buf);
  const doc = zip.file("word/document.xml");
  if (!doc) throw new Error("That doesn't look like a Word document.");
  const xml = new DOMParser().parseFromString(await doc.async("string"), "application/xml");
  const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
  const out: string[] = [];
  for (const p of Array.from(xml.getElementsByTagNameNS(W, "p"))) {
    let line = "";
    const walk = (n: Element) => {
      for (const c of Array.from(n.children)) {
        if (c.namespaceURI === W && c.localName === "t") line += c.textContent ?? "";
        else if (c.namespaceURI === W && c.localName === "tab") line += "\t";
        else if (c.namespaceURI === W && (c.localName === "br" || c.localName === "cr")) line += "\n";
        else walk(c);
      }
    };
    walk(p);
    out.push(line);
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

async function pdfText(buf: ArrayBuffer): Promise<string> {
  try {
    const { extractText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(buf));
    const { text } = await extractText(pdf, { mergePages: true });
    return String(text ?? "").trim();
  } catch {
    return ""; // scanned or unusual PDFs: Muse Spark still reads the file natively; quotes just can't be checked.
  }
}

export async function readResumeFile(file: File): Promise<ReadResume> {
  const name = file.name || "resume";
  const lower = name.toLowerCase();
  const buf = await file.arrayBuffer();
  const head = new Uint8Array(buf.slice(0, 5));
  const isPdf = String.fromCharCode(...head) === "%PDF-";
  const isZip = head[0] === 0x50 && head[1] === 0x4b;

  if (lower.endsWith(".pdf") || file.type === "application/pdf") {
    if (!isPdf) throw new Error("That file doesn't look like a real PDF.");
    if (file.size > RESUME_LIMITS.maxPdfBytes) throw new Error("Please use a PDF under 5 MB.");
    const [text, pdfDataUrl] = await Promise.all([pdfText(buf.slice(0)), fileToDataUrl(new Blob([buf], { type: "application/pdf" }))]);
    return { kind: "pdf", fileName: name, text: text.slice(0, RESUME_LIMITS.maxTextChars), pdfDataUrl };
  }
  if (lower.endsWith(".docx") || file.type === DOCX_MIME) {
    if (!isZip) throw new Error("That file doesn't look like a real Word (.docx) document.");
    if (file.size > RESUME_LIMITS.maxPdfBytes) throw new Error("Please use a document under 5 MB.");
    const text = await docxText(buf);
    if (text.length < RESUME_LIMITS.minTextChars) throw new Error("We couldn't find enough text in that document.");
    return { kind: "docx", fileName: name, text: text.slice(0, RESUME_LIMITS.maxTextChars) };
  }
  throw new Error("Please choose a PDF or Word (.docx) file.");
}
