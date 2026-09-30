import { createWriteStream } from "node:fs";
import { finished } from "node:stream/promises";
import { ZipArchive } from "archiver";

const output = createWriteStream("cloudflare-warp-toggle.zip");
const archive = new ZipArchive({ zlib: { level: 9 } });

const done = finished(output);

archive.on("error", (err) => output.destroy(err));
archive.on("warning", (err) => output.destroy(err));

archive.pipe(output);

archive.directory("src/", false, (entry) => {
  if (entry.name === "schemas/gschemas.compiled") {
    return false;
  }

  return entry;
});

archive.file("LICENSE", { name: "LICENSE" });

await archive.finalize();
await done;
