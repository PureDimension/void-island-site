import fs from "fs";
import path from "path";
import matter from "gray-matter";
import MainSectionPage from "@/app/MainSectionPage";

export default function BlogPage({ params }) {
	const section_name = params.section;
	const sectionDir = path.join(process.cwd(), "blog", section_name);
	let posts = [];
	if (fs.existsSync(sectionDir)) {
		const files = fs.readdirSync(sectionDir).filter((f) => f.endsWith(".md"));
		posts = files.map((filename) => {
			const filePath = path.join(sectionDir, filename);
			const fileContent = fs.readFileSync(filePath, "utf-8");
			const { data, content } = matter(fileContent);
			// 保证 date 是字符串
			let dateStr = data.date
				? String(data.date)
				: filename.split("-").slice(0, 3).join("-");
			return {
				title: data.title || filename.replace(/\.md$/, ""),
				excerpt:
					data.excerpt ||
					content.slice(0, 120) + (content.length > 120 ? "..." : ""),
				date: dateStr,
				slug: filename.replace(/\.md$/, ""),
				tags: data.tags || [],
				section: section_name,
				content,
			};
		});
	}
	return <MainSectionPage posts={posts} section_name={section_name} />;
}
