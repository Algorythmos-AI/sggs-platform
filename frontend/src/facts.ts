// facts.ts — the counts the marketing pages quote. They come from src/generated/landing-facts.json,
// which scripts/gen_landing_verse.py writes from db/sggs.sqlite and public/contributors.json (the
// roster the app reads too). Never type a count into a page: import it from here.
import raw from "./generated/landing-facts.json";

export const FACTS = raw;

/** 60658 → "60,658" */
export const fmt = (n: number) => n.toLocaleString("en-US");

export const ordinal = (n: number) => {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
};

/** The span of the voices' dated lives, by century: "12th to 17th century". */
export const VOICE_CENTURIES = `${ordinal(FACTS.voices_first_century)} to ${ordinal(FACTS.voices_last_century)} century`;

const ONES = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
  "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

/** 31 → "Thirty-one" (headings spell small counts out); 100 and over stay as digits. */
export const spell = (n: number) => {
  const w = n < 20 ? ONES[n] : n < 100 ? TENS[Math.floor(n / 10)] + (n % 10 ? `-${ONES[n % 10]}` : "") : fmt(n);
  return w.charAt(0).toUpperCase() + w.slice(1);
};
