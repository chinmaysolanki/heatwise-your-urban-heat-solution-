/**
 * Export all docs/ files to PDF using Playwright headless Chromium.
 * Handles: .html (styled A4) and .md (rendered with HeatWise brand styles)
 * Output: docs/pdf/
 */
import { chromium } from "playwright";
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "fs";
import { join, basename, extname } from "path";
import { fileURLToPath } from "url";

const __dir = fileURLToPath(new URL(".", import.meta.url));
const DOCS_DIR = join(__dir, "../docs");
const PDF_DIR  = join(DOCS_DIR, "pdf");

mkdirSync(PDF_DIR, { recursive: true });

// ── Simple Markdown → HTML renderer ──────────────────────────────────────────
function mdToHtml(md, title) {
  let html = md
    // Headings
    .replace(/^#{6}\s+(.+)$/gm, "<h6>$1</h6>")
    .replace(/^#{5}\s+(.+)$/gm, "<h5>$1</h5>")
    .replace(/^#{4}\s+(.+)$/gm, "<h4>$1</h4>")
    .replace(/^###\s+(.+)$/gm,  "<h3>$1</h3>")
    .replace(/^##\s+(.+)$/gm,   "<h2>$1</h2>")
    .replace(/^#\s+(.+)$/gm,    "<h1>$1</h1>")
    // Bold / italic / code
    .replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>")
    .replace(/\*\*(.+?)\*\*/g,     "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g,         "<em>$1</em>")
    .replace(/`([^`\n]+)`/g,       "<code>$1</code>")
    // Fenced code blocks
    .replace(/```(\w*)\n([\s\S]*?)```/gm, (_, lang, code) =>
      `<pre><code class="lang-${lang}">${escape(code)}</code></pre>`)
    // Horizontal rules
    .replace(/^---+$/gm, "<hr/>")
    // Blockquotes
    .replace(/^>\s+(.+)$/gm, "<blockquote>$1</blockquote>")
    // Unordered lists
    .replace(/^\s*[-*+]\s+(.+)$/gm, "<li>$1</li>")
    // Ordered lists
    .replace(/^\s*\d+\.\s+(.+)$/gm, "<li>$1</li>")
    // Tables (basic)
    .replace(/^\|(.+)\|$/gm, (line) => {
      if (/^[\|\s\-:]+$/.test(line)) return "";
      const cells = line.split("|").slice(1, -1).map(c => c.trim());
      return "<tr>" + cells.map(c => `<td>${c}</td>`).join("") + "</tr>";
    })
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    // Paragraphs (blank-line separated blocks that aren't block elements)
    .replace(/\n{2,}/g, "\n</p><p>\n");

  // Wrap loose <li> in <ul>
  html = html.replace(/(<li>[\s\S]*?<\/li>)(\s*(?!<li>))/g, (m) => {
    if (!m.startsWith("<ul>")) return "<ul>" + m + "</ul>";
    return m;
  });
  // Wrap table rows in <table>
  html = html.replace(/(<tr>[\s\S]*?<\/tr>)/g, "<table>$1</table>");

  return `<p>${html}</p>`;
}

function escape(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function wrapMdInPage(body, title) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>${title}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap');
  @page { size: A4 portrait; margin: 18mm 18mm 20mm 18mm; }
  * { margin:0; padding:0; box-sizing:border-box; }
  body {
    font-family: 'DM Sans', sans-serif;
    font-size: 9.5pt;
    color: #D8F3DC;
    background: #09160E;
    line-height: 1.65;
  }
  /* Page header */
  .doc-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-bottom: 4mm;
    border-bottom: 0.5pt solid rgba(82,183,136,.25);
    margin-bottom: 7mm;
  }
  .doc-header .brand {
    display: flex;
    align-items: center;
    gap: 7px;
  }
  .brand-mark {
    width: 22px; height: 22px;
    background: linear-gradient(135deg,#2D6A4F,#52B788);
    border-radius: 6px;
    display: inline-flex; align-items: center; justify-content: center;
  }
  .brand-name { font-size: 11pt; font-weight: 700; color: #D8F3DC; }
  .doc-title-label {
    font-family: 'DM Mono', monospace;
    font-size: 6.5pt;
    color: #52B788;
    letter-spacing: 2px;
    text-transform: uppercase;
    text-align: right;
  }
  /* Typography */
  h1 {
    font-size: 17pt; font-weight: 700; color: #D8F3DC;
    margin: 7mm 0 4mm; line-height: 1.2;
    padding-bottom: 2mm;
    border-bottom: 0.5pt solid rgba(82,183,136,.25);
  }
  h2 {
    font-size: 12pt; font-weight: 700; color: #52B788;
    margin: 6mm 0 2.5mm; letter-spacing: 0.3px;
  }
  h3 {
    font-size: 9.5pt; font-weight: 600; color: #D8F3DC;
    margin: 4mm 0 2mm; letter-spacing: 0.2px;
  }
  h4, h5, h6 {
    font-size: 8.5pt; font-weight: 600; color: rgba(216,243,220,.7);
    margin: 3mm 0 1.5mm;
  }
  p {
    margin-bottom: 2.5mm;
    color: rgba(216,243,220,.85);
  }
  a { color: #52B788; text-decoration: none; }
  strong { font-weight: 700; color: #D8F3DC; }
  em { font-style: italic; color: rgba(216,243,220,.8); }
  code {
    font-family: 'DM Mono', monospace;
    font-size: 8pt;
    background: rgba(82,183,136,.10);
    border: 0.4pt solid rgba(82,183,136,.2);
    border-radius: 3px;
    padding: 1px 4px;
    color: #52B788;
  }
  pre {
    background: rgba(0,0,0,.45);
    border: 0.5pt solid rgba(82,183,136,.2);
    border-radius: 5px;
    padding: 4mm;
    margin: 3mm 0;
    overflow: hidden;
    page-break-inside: avoid;
  }
  pre code {
    background: none;
    border: none;
    padding: 0;
    font-size: 7.5pt;
    color: rgba(216,243,220,.85);
    display: block;
    white-space: pre-wrap;
    word-break: break-word;
  }
  ul, ol {
    padding-left: 5mm;
    margin: 2mm 0 3mm;
  }
  li {
    margin-bottom: 1mm;
    color: rgba(216,243,220,.85);
    line-height: 1.55;
  }
  blockquote {
    border-left: 2pt solid #52B788;
    padding: 2mm 4mm;
    margin: 3mm 0;
    background: rgba(82,183,136,.05);
    color: rgba(216,243,220,.7);
    font-style: italic;
  }
  hr {
    border: none;
    border-top: 0.5pt solid rgba(82,183,136,.25);
    margin: 5mm 0;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    margin: 3mm 0;
    font-size: 8pt;
    page-break-inside: avoid;
  }
  td, th {
    padding: 2mm 3mm;
    border: 0.4pt solid rgba(82,183,136,.2);
    color: rgba(216,243,220,.85);
    vertical-align: top;
    line-height: 1.4;
  }
  th {
    background: rgba(82,183,136,.10);
    color: #52B788;
    font-family: 'DM Mono', monospace;
    font-size: 7pt;
    letter-spacing: 1px;
    font-weight: 500;
  }
  tr:nth-child(even) td { background: rgba(255,255,255,.02); }
  /* Footer */
  .doc-footer {
    position: fixed;
    bottom: 0; left: 0; right: 0;
    padding: 3mm 0 2mm;
    border-top: 0.4pt solid rgba(82,183,136,.15);
    display: flex;
    justify-content: space-between;
    font-family: 'DM Mono', monospace;
    font-size: 6pt;
    color: rgba(216,243,220,.25);
    letter-spacing: 1px;
  }
</style>
</head>
<body>
  <div class="doc-header">
    <div class="brand">
      <div class="brand-mark">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#D8F3DC" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z"/>
          <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>
        </svg>
      </div>
      <span class="brand-name">HeatWise</span>
    </div>
    <div class="doc-title-label">${title}</div>
  </div>
  <div class="doc-body">
    ${body}
  </div>
  <div class="doc-footer">
    <span>HEATWISE DOCUMENTATION</span>
    <span>${title.toUpperCase()}</span>
    <span>APRIL 2026</span>
  </div>
</body>
</html>`;
}

// ── Main ──────────────────────────────────────────────────────────────────────
const browser = await chromium.launch();
const files = readdirSync(DOCS_DIR).filter(f => {
  const ext = extname(f).toLowerCase();
  return (ext === ".html" || ext === ".md") && !f.startsWith(".");
});

console.log(`\nFound ${files.length} document(s) to convert:\n`);
files.forEach(f => console.log(`  · ${f}`));
console.log();

for (const file of files) {
  const srcPath = join(DOCS_DIR, file);
  const nameNoExt = basename(file, extname(file));
  const pdfPath   = join(PDF_DIR, `${nameNoExt}.pdf`);
  const ext = extname(file).toLowerCase();

  process.stdout.write(`  Converting ${file} → pdf/${nameNoExt}.pdf … `);

  try {
    const page = await browser.newPage();

    if (ext === ".html") {
      const html = readFileSync(srcPath, "utf8");
      await page.setContent(html, { waitUntil: "networkidle" });
    } else {
      // Markdown
      const raw   = readFileSync(srcPath, "utf8");
      const body  = mdToHtml(raw, nameNoExt);
      const html  = wrapMdInPage(body, nameNoExt.replace(/_/g, " "));
      await page.setContent(html, { waitUntil: "networkidle" });
    }

    await page.pdf({
      path: pdfPath,
      format: "A4",
      printBackground: true,
      margin: ext === ".html"
        ? { top: "0", right: "0", bottom: "0", left: "0" }  // HTML has its own padding
        : { top: "18mm", right: "18mm", bottom: "20mm", left: "18mm" },
    });

    await page.close();
    console.log("✓");
  } catch (err) {
    console.log("✗  ERROR:", err.message);
  }
}

await browser.close();

console.log(`\nAll PDFs saved to:\n  ${PDF_DIR}\n`);
