import type { Locale } from "./config";
import { en } from "./messages/en";
import { fa } from "./messages/fa";
import type { Messages } from "./messages/types";

const catalog: Record<Locale, Messages> = { fa, en };

export function getMessages(locale: Locale): Messages {
  return catalog[locale];
}
