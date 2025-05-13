// lib/getRecentBlogMetadata.js
import { logs } from "../commit-log"; // 路径请根据实际位置调整

export default function getRecentBlogMetadata() {
  return logs.map((entry) => {
    const { title, date, slug, section } = entry;

    return {
      title,
      date,
      slug,
      section,
    };
  });
}
