import "server-only";

import { readdir } from "fs/promises";
import path from "path";

const VIDEO_EXT = /\.(mp4|mov)$/i;

export type DemoCreative = {
  filename: string;
  path: string;
  title: string;
};

export async function listDemoCreatives(): Promise<DemoCreative[]> {
  const dir = path.join(process.cwd(), "public", "creatives");
  try {
    const entries = await readdir(dir);
    return entries
      .filter((name) => VIDEO_EXT.test(name))
      .sort()
      .map((filename) => ({
        filename,
        path: `/creatives/${filename}`,
        title: filename
          .replace(/\.[^.]+$/, "")
          .replaceAll("_", " ")
          .slice(0, 64),
      }));
  } catch {
    return [];
  }
}
