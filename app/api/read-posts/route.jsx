import fs from "fs";
import path from "path";
import matter from "gray-matter";

export async function GET(req) {
	const { searchParams } = new URL(req.url);
	const section = searchParams.get("section");

	if (!section) {
		return new Response(JSON.stringify({ error: "Missing section" }), {
			status: 400,
		});
	}

	const dir = path.join(process.cwd(), "blog", section);
	if (!fs.existsSync(dir)) {
		return new Response(JSON.stringify([]));
	}

	const files = fs.readdirSync(dir);
	const posts = files
		.filter((file) => file.endsWith(".md"))
		.map((file) => {
			const slug = file.replace(/\.md$/, "");
			const rawContent = fs.readFileSync(path.join(dir, file), "utf-8");
			const { data, content } = matter(rawContent);

			// 从文件名中提取前缀的日期部分
			const match = slug.match(/^(\d{4}-\d{1,2}-\d{1,2})-/);
			const dateFromFilename = match ? match[1] : "";

			return {
				slug,
				title: data.title || slug,
				date: dateFromFilename,
				excerpt: data.excerpt || content.slice(0, 100),
				tags: Array.isArray(data.tags) ? data.tags : [],
			};
		});

	return new Response(JSON.stringify(posts), {
		headers: { "Content-Type": "application/json" },
	});
}
