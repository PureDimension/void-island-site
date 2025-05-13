import fs from "fs";
import path from "path";
import matter from "gray-matter";
import { recentBlogs } from "../commit-log"; // 根据实际路径调整

export default function getRecentBlogMetadata() {
  return recentBlogs.map((relativePath) => {
    const fullPath = path.join(process.cwd(), relativePath);
    const fileContent = fs.readFileSync(fullPath, "utf-8");
    const { data } = matter(fileContent);
    const parts = relativePath.split("/");
    const section = parts[1];
    return {
      date: data.date || "",
      title: data.title || "",
      section,
    };
  });
}
