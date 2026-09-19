import axios from "axios";
import { CRAWL_DELAY_MS } from "./config.js";

const client = axios.create({
  timeout: 25000,
  headers: {
    "User-Agent": "PCZone-Educational-Crawler/1.0 (+student project; respectful rate limit)",
    "Accept-Language": "vi-VN,vi;q=0.9,en;q=0.8",
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  },
});

let requestGate: Promise<void> = Promise.resolve();
let lastRequestStartedAt = 0;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Serializes only the request-start scheduling. Responses may still overlap,
// but two requests will not be started closer than CRAWL_DELAY_MS.
async function waitForRequestSlot() {
  let release!: () => void;
  const previousGate = requestGate;
  requestGate = new Promise<void>((resolve) => {
    release = resolve;
  });

  await previousGate;
  const elapsed = Date.now() - lastRequestStartedAt;
  if (elapsed < CRAWL_DELAY_MS) {
    await sleep(CRAWL_DELAY_MS - elapsed);
  }
  lastRequestStartedAt = Date.now();
  release();
}

export async function getHtml(url: string): Promise<string> {
  await waitForRequestSlot();
  const response = await client.get<string>(url);
  return response.data;
}
