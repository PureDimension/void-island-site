// lib/getRecentBlogMetadata.js
import { logs } from "../commit-log"; // 路径请根据实际位置调整

export default function getRecentBlogMetadata() {
  return logs.map((entry) => {
    const { title, date, slug } = entry;

    // 根据 slug 推测所属的 section（如 blog/tech/xxx.md → tech）
    const parts = slug.split("/");
    const section = parts.length > 1 ? parts[0] : "blog";

    return {
      title,
      date,
      slug,
      section,
    };
  });
}
