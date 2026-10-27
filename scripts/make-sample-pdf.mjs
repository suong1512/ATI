/**
 * Generates `samples/sample-invoice.pdf`, a small 2-page PDF invoice used to test
 * the upload flow. No dependencies required.
 *
 * Usage: node scripts/make-sample-pdf.mjs
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const outputPath = join(projectRoot, "samples", "sample-invoice.pdf");

const pages = [
  [
    "HOA DON GIA TRI GIA TANG - SAMPLE FILE",
    "So: 0001234   Ky hieu: 1C25TAA",
    "Ngay: 30/09/2026",
    "",
    "Nguoi ban: CONG TY TNHH THUONG MAI AN PHAT",
    "MST: 0312345678",
    "",
    "Nguoi mua: CONG TY TNHH PHAN MEM ATI",
    "MST: 0398765432",
    "",
    "STT  Ten hang hoa                     SL    Don gia       Thanh tien",
    "1    But bi Thien Long TL-027          20    5.000         100.000",
    "2    Giay in A4 Double A 70gsm          5    85.000        425.000",
    "",
    "Cong tien hang:                                        525.000",
    "Thue GTGT 10%:                                          52.500",
    "Tong thanh toan:                                       577.500",
  ],
  [
    "PHU LUC HOA DON - TRANG 2",
    "",
    "Ghi chu: file mau de test chuc nang upload.",
    "Du lieu trong file la gia lap, khong phai hoa don that.",
  ],
];

const escapeText = (line) => line.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");

function contentStream(lines) {
  return [
    "BT",
    "/F1 11 Tf",
    "15 TL",
    "1 0 0 1 50 780 Tm",
    ...lines.map((line) => `(${escapeText(line)}) Tj T*`),
    "ET",
  ].join("\n");
}

const objects = [];
const pageNumbers = [];
const contentNumbers = [];
let nextNumber = 3;

for (let index = 0; index < pages.length; index += 1) {
  pageNumbers.push(nextNumber++);
  contentNumbers.push(nextNumber++);
}
const fontNumber = nextNumber++;

objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
objects[2] = `<< /Type /Pages /Kids [${pageNumbers.map((n) => `${n} 0 R`).join(" ")}] /Count ${pages.length} >>`;
objects[fontNumber] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";

pages.forEach((lines, index) => {
  const stream = contentStream(lines);
  objects[contentNumbers[index]] = `<< /Length ${Buffer.byteLength(stream, "latin1")} >>\nstream\n${stream}\nendstream`;
  objects[pageNumbers[index]] =
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] " +
    `/Resources << /Font << /F1 ${fontNumber} 0 R >> >> /Contents ${contentNumbers[index]} 0 R >>`;
});

let pdf = "%PDF-1.4\n";
const offsets = [];
for (let number = 1; number <= fontNumber; number += 1) {
  offsets[number] = Buffer.byteLength(pdf, "latin1");
  pdf += `${number} 0 obj\n${objects[number]}\nendobj\n`;
}

const xrefOffset = Buffer.byteLength(pdf, "latin1");
const size = fontNumber + 1;
pdf += `xref\n0 ${size}\n0000000000 65535 f \n`;
for (let number = 1; number <= fontNumber; number += 1) {
  pdf += `${String(offsets[number]).padStart(10, "0")} 00000 n \n`;
}
pdf += `trailer\n<< /Size ${size} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, Buffer.from(pdf, "latin1"));
console.log(`Wrote ${outputPath} (${Buffer.byteLength(pdf, "latin1")} bytes, ${pages.length} pages)`);
