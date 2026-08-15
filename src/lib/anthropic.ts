import Anthropic from "@anthropic-ai/sdk";
import type { Language } from "./types";

/**
 * Model used for all Claude calls in GovMatch.
 * Kept in one place so it is trivial to change.
 */
export const CLAUDE_MODEL = "claude-sonnet-4-6";

let client: Anthropic | null = null;

/**
 * Lazily construct the Anthropic client. The API key comes ONLY from the
 * environment (process.env.ANTHROPIC_API_KEY) and is never hardcoded.
 */
export function getAnthropic(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Copy .env.example to .env.local and add your key."
    );
  }
  if (!client) {
    client = new Anthropic({ apiKey });
  }
  return client;
}

/** Human-readable language name for embedding in system prompts. */
export function languageName(lang: Language): string {
  return lang === "es" ? "Spanish (español)" : "English";
}

/**
 * Ask Claude for a JSON response and parse it robustly.
 *
 * Every route in GovMatch expects Claude to return ONLY JSON. Models sometimes
 * wrap JSON in prose or code fences, so we extract the first balanced JSON
 * object/array before parsing.
 */
export async function claudeJson<T>(opts: {
  system: string;
  user: string;
  maxTokens?: number;
  temperature?: number;
}): Promise<T> {
  const anthropic = getAnthropic();
  const message = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: opts.maxTokens ?? 4096,
    temperature: opts.temperature ?? 0.2,
    system: opts.system,
    messages: [{ role: "user", content: opts.user }],
  });

  const text = message.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("\n");

  return parseJson<T>(text);
}

/** Extract and parse the first JSON value found in an LLM response string. */
export function parseJson<T>(text: string): T {
  const cleaned = stripCodeFences(text).trim();

  // Fast path: the whole string is valid JSON.
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    // fall through to extraction
  }

  const extracted = extractFirstJson(cleaned);
  if (extracted) {
    return JSON.parse(extracted) as T;
  }

  throw new Error("Claude did not return valid JSON.");
}

function stripCodeFences(text: string): string {
  return text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .replace(/```(?:json)?/gi, "");
}

/** Find the first balanced {...} or [...] block in a string. */
function extractFirstJson(text: string): string | null {
  const startObj = text.indexOf("{");
  const startArr = text.indexOf("[");
  let start = -1;
  if (startObj === -1) start = startArr;
  else if (startArr === -1) start = startObj;
  else start = Math.min(startObj, startArr);
  if (start === -1) return null;

  const open = text[start];
  const close = open === "{" ? "}" : "]";
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
    } else if (ch === open) {
      depth++;
    } else if (ch === close) {
      depth--;
      if (depth === 0) {
        return text.slice(start, i + 1);
      }
    }
  }
  return null;
}
