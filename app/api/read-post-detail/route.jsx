import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';  // 引入 gray-matter 用于解析 front matter

// 获取单篇文章的详细内容
export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const section = searchParams.get('section');
  const slug = searchParams.get('slug');
  const basePath = path.join(process.cwd(), 'blog', section);

  if (slug) {
    const filePath = path.join(basePath, `${slug}.md`);
    try {
      // 读取文件内容
      const content = fs.readFileSync(filePath, 'utf-8');

      // 使用 gray-matter 解析 markdown 文件，获取 front matter 和内容
      const { data, content: bodyContent } = matter(content);

      // 返回解析后的数据
      return new Response(
        JSON.stringify({
          title: data.title,      // 从 front matter 中提取 title
          excerpt: data.excerpt,  // 从 front matter 中提取 excerpt
          content: bodyContent,   // 正文内容
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    } catch (e) {
      return new Response('未找到文章', { status: 404 });
    }
  } else {
    return new Response('未提供有效的slug', { status: 400 });
  }
}
