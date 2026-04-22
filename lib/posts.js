import fs from "fs";
import path from "path";
import matter from "gray-matter";

// 导入 commit-log.js 中的 lastModified 对象，路径按实际项目调整
import { lastModified as commitLogLastModified } from "../commit-log.js";

/**
 * 加载指定 section 的所有 posts
 * @param {string} sectionName - 文件夹名，例如 "poetry" 或 "essay"
 * @returns {Array} - 包含 metadata 和正文内容的 posts
 */
export function getPostsBySection(sectionName) {
  const sectionDir = path.join(process.cwd(), "blog", sectionName);
  let posts = [];

  if (fs.existsSync(sectionDir)) {
    const files = fs
      .readdirSync(sectionDir)
      .filter((f) => f.endsWith(".md"));

    posts = files.map((filename) => {
      const filePath = path.join(sectionDir, filename);
      const fileContent = fs.readFileSync(filePath, "utf-8");
      const { data, content } = matter(fileContent);

      // 统一路径格式
      const relativePath = path.relative(process.cwd(), filePath).replace(/\\/g, "/");
      const lastModified = commitLogLastModified[relativePath] || null;

      let dateStr = data.date
        ? String(data.date)
        : filename.split("-").slice(0, 3).join("-");

      return {
        title: data.title || filename.replace(/\.md$/, ""),
        excerpt: data.excerpt,
        date: dateStr,
        slug: filename.replace(/\.md$/, ""),
        tags: data.tags || [],
        section: sectionName,
        lastModified,
        top: data.top,
        encrypted: Boolean(data.encrypted),
        verify: data.verify || null,
        salt: data.salt || null,
        iv: data.iv || null,
        iterations: data.iterations || null,
        content,
      };
    });
  }

  return posts;
}
