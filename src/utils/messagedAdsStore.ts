import fs from "node:fs/promises";
import { writeFileAtomic } from "./files";

export type MessagedAdsStoreV1 = {
  version: 1;
  /**
   * Map of adId -> metadata. Map form gives O(1) lookups.
   */
  ads: Record<
    string,
    {
      firstMessagedAtIso: string;
      url: string;
      messageTemplateIndex: number;
    }
  >;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export async function loadMessagedAdsStore(
  filePath: string
): Promise<MessagedAdsStoreV1> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || parsed.version !== 1 || !isRecord(parsed.ads)) {
      throw new Error("invalid schema");
    }
    return parsed as MessagedAdsStoreV1;
  } catch (err) {
    // If missing/corrupt, start fresh (but keep schema stable).
    return { version: 1, ads: {} };
  }
}

export async function saveMessagedAdsStore(
  filePath: string,
  store: MessagedAdsStoreV1
): Promise<void> {
  await writeFileAtomic(filePath, JSON.stringify(store, null, 2) + "\n");
}

