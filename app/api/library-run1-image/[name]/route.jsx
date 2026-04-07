import fs from "fs";
import path from "path";

const IMAGE_FILE_MAP = {
  infinity: "infinity.png",
};

export async function GET(_request, context) {
  const params = await context?.params;
  const name = params?.name;
  const fileName = IMAGE_FILE_MAP[name];

  if (!fileName) {
    return new Response("Not Found", { status: 404 });
  }

  const filePath = path.join(
    process.cwd(),
    "game-scripts",
    "LibraryRun1",
    fileName
  );

  if (!fs.existsSync(filePath)) {
    return new Response("Not Found", { status: 404 });
  }

  const fileBuffer = fs.readFileSync(filePath);

  return new Response(fileBuffer, {
    status: 200,
    headers: {
      "Content-Type": "image/png",
      "Content-Length": String(fileBuffer.length),
      "Cache-Control": "public, max-age=3600",
    },
  });
}
