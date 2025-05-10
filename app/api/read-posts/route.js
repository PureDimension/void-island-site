import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const section = searchParams.get('section');

  if (!section) {
    return new Response(JSON.stringify({ error: 'Missing section' }), { status: 400 });
  }

  const dir = path.join(process.cwd(), 'blog', section);
  if (!fs.existsSync(dir)) {
    return new Response(JSON.stringify([]));
  }

  const files = fs.readdirSync(dir);
  const posts = files
    .filter(file => file.endsWith('.md'))
    .map(file => {
      const slug = file.replace(/\.md$/, '');
      const rawContent = fs.readFileSync(path.join(dir, file), 'utf-8');
      const { data, content } = matter(rawContent);

      return {
        slug,
        title: data.title || slug,
        date: data.date?.split('T')[0] || '',
        excerpt: data.excerpt || content.slice(0, 100),
        keywords: Array.isArray(data.keywords) ? data.keywords : [],
      };
    });

  return new Response(JSON.stringify(posts), {
    headers: { 'Content-Type': 'application/json' },
  });
}
