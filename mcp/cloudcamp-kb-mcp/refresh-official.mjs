// Deliberate, human-run refresh of an OFFICIAL knowledge base file directly
// from cloudcampbd.com.
//
// cloudcampbd.com is a client-rendered SPA (React root div, real content
// loads via JS) — a plain fetch() only returns an empty shell, so this uses
// a local headless browser (Playwright/Chromium) to render the page, then
// converts the rendered DOM to markdown with a deterministic library
// (turndown). No LLM is involved anywhere in this pipeline: nothing about
// the page content is sent to any third-party AI provider, unlike an
// LLM-extraction scraper (e.g. ScrapeGraphAI) would require.
//
// Two modes, both NEVER write to disk automatically — they render/convert
// and print; a human decides whether to hand-merge the result:
//
//   npm run refresh:official        (plain mode, default)
//     One render of the target page, converted to markdown. Fast. Misses
//     anything gated behind a click (tabs, accordions, modals).
//
//   npm run refresh:official:deep   (or: node refresh-official.mjs --deep)
//     Same render, but also CLICKS THROUGH UI-gated content a plain render
//     can't reach: on the Congress page specifically, that's the 11 domain
//     tabs (only the default-selected domain's sub-challenges render
//     without a click), the "Awards" nav item, and all ~281 FAQ question
//     accordions/modals (only titles render without a click). Slower
//     (~290 read-only clicks against the live page, a couple of minutes)
//     and only useful for pages that have this kind of gated content —
//     currently just the Congress page.
//
//     Known finding (2026-09-20): clicking "Awards" in the top nav does
//     NOT currently reveal a distinct prize-amount section — it's captured
//     anyway in case the site adds real content behind that click later,
//     but as of this writing the only published prize figure anywhere
//     (this page, the FAQ, or the official Participants Guide doc linked
//     from Resources & Links) is one illustrative example under the "What
//     are the prizes?" FAQ answer: "the E-Commerce domain awards 50,000
//     BDT to the Champion and 30,000 BDT to the Runner-Up." No full prize
//     sheet is publicly reachable via this page as of that date.
import { chromium } from "playwright";
import TurndownService from "turndown";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const DEEP = process.argv.includes("--deep") || process.env.CLOUDCAMP_DEEP === "1";

const DEFAULT_URL = DEEP
  ? "https://cloudcampbd.com/ai-builders-congress"
  : "https://cloudcampbd.com/the-infinity-ai-buildfest";
const TARGET_URL = process.env.CLOUDCAMP_OFFICIAL_URL || DEFAULT_URL;

console.log("This will launch a local headless Chromium to RENDER (not just");
console.log(`download) the live page at:\n    ${TARGET_URL}`);
if (DEEP) {
  console.log("...and then CLICK THROUGH its domain tabs, the Awards nav item,");
  console.log("and all FAQ question accordions to capture content a single");
  console.log("render can't reach. This is a heavier pass: it will click");
  console.log("roughly 291 elements on the live page (11 domain tabs + the");
  console.log("Awards nav item + ~281 FAQ questions), all read-only");
  console.log("interactions against cloudcampbd.com.");
}
console.log("No LLM or third-party AI service is involved — rendering,");
console.log("clicking, and HTML-to-markdown conversion all happen locally.");
console.log("");

const cli = createInterface({ input, output });
const proceed = await cli.question("Proceed? [y/N] ");
if (!/^y(es)?$/i.test(proceed.trim())) {
  console.log("Cancelled. No files touched, no requests made.");
  cli.close();
  process.exit(0);
}
cli.close();

const browser = await chromium.launch();
let markdown;
let deepSections = [];
try {
  const page = await browser.newPage();
  await page.goto(TARGET_URL, { waitUntil: "networkidle", timeout: 30000 });
  // Give client-side rendering a moment beyond networkidle for any
  // post-load hydration/animation-gated content.
  await page.waitForTimeout(2000);

  if (DEEP) {
    deepSections = await runDeepCapture(page);
  }

  // Strip script/style/noscript IN THE BROWSER before extracting HTML, so
  // no inline JS (which can contain page-internal API keys, tracking, etc.)
  // or CSS ever reaches the markdown conversion step or this script's output.
  await page.evaluate(() => {
    document.querySelectorAll("script, style, noscript, link[rel='preload']").forEach((el) => el.remove());
  });
  const html = await page.content();

  const turndown = new TurndownService({ headingStyle: "atx" });
  // Belt-and-suspenders: also strip at the markdown layer in case anything
  // slipped through (e.g. content injected after the evaluate() call above).
  turndown.remove(["script", "style", "noscript"]);
  markdown = turndown.turndown(html).replace(/\n{3,}/g, "\n\n").trim();
} finally {
  await browser.close();
}

console.log("");
console.log(`Rendered and converted ${markdown.length} chars of markdown.`);
if (DEEP) console.log(`Plus ${deepSections.length} click-through sections captured below.`);
console.log("This script does NOT auto-overwrite any knowledge-base file.");
console.log("Review the output below (or redirect this script's stdout to a scratch");
console.log("file and diff it against that file) before deciding whether to hand-merge");
console.log("any changes in — and update the file's provenance header if you do.");
console.log("");
console.log("=".repeat(72));
console.log(markdown);
if (DEEP) {
  console.log("");
  console.log(deepSections.join("\n"));
}
console.log("=".repeat(72));

// ---- Deep-mode click-through capture (domain tabs + FAQ accordions) ----
async function runDeepCapture(page) {
  const out = [];

  // ---- Domain tabs: click each, capture its sub-challenge list ----
  out.push("## Domains & Challenges (full, click-through capture)\n");
  const domainNames = await page.evaluate(() => {
    const heading = [...document.querySelectorAll("h2,h3")].find((h) =>
      h.textContent.includes("Domains & Challenges")
    );
    if (!heading) return [];
    const container = heading.closest("section");
    const tabs = [...container.querySelectorAll("button")].filter((b) =>
      /Sphere AI\d+$/.test(b.textContent.trim())
    );
    return tabs.map((b) => b.textContent.trim().replace(/\d+$/, ""));
  });

  for (const name of domainNames) {
    const result = await page.evaluate((domainName) => {
      const heading = [...document.querySelectorAll("h2,h3")].find((h) =>
        h.textContent.includes("Domains & Challenges")
      );
      const container = heading.closest("section");
      const tabs = [...container.querySelectorAll("button")].filter((b) =>
        /Sphere AI\d+$/.test(b.textContent.trim())
      );
      const tab = tabs.find((b) => b.textContent.trim().replace(/\d+$/, "") === domainName);
      if (!tab) return null;
      tab.click();
      return true;
    }, name);
    if (!result) continue;
    await page.waitForTimeout(400);
    const detail = await page.evaluate(() => {
      const heading = [...document.querySelectorAll("h2,h3")].find((h) =>
        h.textContent.includes("Domains & Challenges")
      );
      const container = heading.closest("section");
      // The active domain's detail panel: heading (h4/h3) matching a
      // "#### Challenge Name" + description pattern, after the tab row.
      const panel = container.querySelector(".bf-domain-summary")?.closest("div")?.parentElement;
      return (panel || container).innerText;
    });
    out.push(`### ${name}\n\n${detail}\n`);
  }

  // ---- Awards nav item: click it, capture whatever the page shows after ----
  // As of 2026-09-20 this does not reveal a distinct section (see the header
  // comment above) — the page content after the click is effectively the
  // same as the un-clicked render. Captured anyway, deliberately, so that if
  // cloudcampbd.com ever adds real prize-sheet content behind this nav item,
  // the next refresh:official:deep run picks it up without code changes.
  out.push("\n## Awards Section (nav click-through capture)\n");
  const awardsClicked = await page.evaluate(() => {
    const target = [...document.querySelectorAll("a, button")].find(
      (el) => el.textContent.trim() === "Awards"
    );
    if (!target) return false;
    target.click();
    return true;
  });
  if (awardsClicked) {
    await page.waitForTimeout(1500);
    const awardsText = await page.evaluate(() => document.body.innerText);
    out.push(awardsText);
  } else {
    out.push("(No element with the exact text \"Awards\" was found in the nav — selector may need updating.)\n");
  }

  // ---- FAQ: select "All", click through every question ----
  out.push("\n## Frequently Asked Questions (full, click-through capture)\n");
  await page.evaluate(() => {
    const heading = [...document.querySelectorAll("h2,h3")].find((h) =>
      h.textContent.includes("Frequently Asked")
    );
    const container = heading.closest("section");
    const allBtn = [...container.querySelectorAll("button")].find((b) =>
      /^All\d+$/.test(b.textContent.trim())
    );
    allBtn?.click();
  });
  await page.waitForTimeout(600);

  const totalQuestions = await page.evaluate(() => {
    const heading = [...document.querySelectorAll("h2,h3")].find((h) =>
      h.textContent.includes("Frequently Asked")
    );
    const container = heading.closest("section");
    return [...container.querySelectorAll("button")].filter((b) =>
      b.getAttribute("aria-label")?.startsWith("Open answer")
    ).length;
  });

  console.error(`Found ${totalQuestions} FAQ questions. Clicking through each...`);

  for (let i = 0; i < totalQuestions; i++) {
    const qa = await page.evaluate((idx) => {
      const heading = [...document.querySelectorAll("h2,h3")].find((h) =>
        h.textContent.includes("Frequently Asked")
      );
      const container = heading.closest("section");
      const qButtons = [...container.querySelectorAll("button")].filter((b) =>
        b.getAttribute("aria-label")?.startsWith("Open answer")
      );
      const btn = qButtons[idx];
      if (!btn) return null;
      btn.click();
      return true;
    }, i);
    if (!qa) continue;
    await page.waitForTimeout(150);
    const text = await page.evaluate(() => {
      const dlg = document.querySelector("[role=dialog]");
      return dlg ? dlg.innerText : null;
    });
    if (text) {
      // dialog innerText is roughly "CATEGORY\nQuestion\nAnswer\nClose"
      const lines = text.split("\n").filter(Boolean);
      if (lines[lines.length - 1] === "Close") lines.pop();
      const [category, question, ...answerLines] = lines;
      out.push(`**[${category}] ${question}**\n${answerLines.join(" ")}\n`);
    }
    // close the dialog
    await page.evaluate(() => {
      const dlg = document.querySelector("[role=dialog]");
      const closeBtn = dlg && [...dlg.querySelectorAll("button")].find((b) => /close/i.test(b.textContent));
      closeBtn?.click();
    });
    await page.waitForTimeout(120);
    if ((i + 1) % 20 === 0) console.error(`  ...${i + 1}/${totalQuestions}`);
  }

  return out;
}
