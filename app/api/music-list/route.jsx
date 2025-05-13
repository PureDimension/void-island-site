import fs from "fs";
import path from "path";

export async function GET() {
	const musicDir = path.join(process.cwd(), "public", "music");
	const files = fs.readdirSync(musicDir);

	const musicList = files
		.filter((file) => file.endsWith(".mp3"))
		.map((file) => {
			const base = file.replace(/\.mp3$/, "");
			const iconFile = files.find((f) => f === `${base}.jpg`) || null;

			return {
				name: base,
				file: `/music/${file}`,
				icon: iconFile ? `/music/${iconFile}` : null,
			};
		});

	return new Response(JSON.stringify(musicList), {
		headers: { "Content-Type": "application/json" },
		status: 200,
	});
}
