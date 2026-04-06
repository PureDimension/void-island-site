import fs from "fs";
import path from "path";

const TRACK_FILE_MAP = {
  tutorial: "tutorial.mp3",
  story: "story.mp3",
  stage1: "stage1.mp3",
  stage2: "stage2.mp3",
  stage3_story_a: "stage3_story_a.mp3",
  stage3_story_b: "stage3_story_b.mp3",
  stage3_story_c: "stage3_story_c.mp3",
  stage3_battle: "stage3_battle.mp3",
  finale: "finale.mp3",
  gun_sample: "gun_sample.mp3",
};

export async function GET(_request, context) {
  const params = await context?.params;
  const track = params?.track;
  const fileName = TRACK_FILE_MAP[track];

  if (!fileName) {
    return new Response("Not Found", { status: 404 });
  }

  const filePath = path.join(
    process.cwd(),
    "game-scripts",
    "LibraryRun1",
    "audio",
    fileName
  );

  if (!fs.existsSync(filePath)) {
    return new Response("Not Found", { status: 404 });
  }

  const fileBuffer = fs.readFileSync(filePath);

  return new Response(fileBuffer, {
    status: 200,
    headers: {
      "Content-Type": "audio/mpeg",
      "Content-Length": String(fileBuffer.length),
      "Cache-Control": "public, max-age=3600",
    },
  });
}
