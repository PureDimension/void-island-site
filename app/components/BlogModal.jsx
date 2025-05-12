'use client';

import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw'; // 引入 rehype-raw 插件

export default function BlogModal({ section, slug, onClose }) {
  const [markdown, setMarkdown] = useState('');
  const [title, setTitle] = useState('');
  const [excerpt, setExcerpt] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchMarkdown() {
      try {
        const res = await fetch(`/api/read-post-detail?section=${section}&slug=${slug}`);
        if (!res.ok) throw new Error('读取失败');
        const data = await res.json(); // 解析为 JSON

        // 提取 title、excerpt 和 content
        setTitle(data.title);
        setExcerpt(data.excerpt);
        setMarkdown(data.content);
      } catch (err) {
        setMarkdown('加载失败，请稍后重试。');
      } finally {
        setLoading(false);
      }
    }
    fetchMarkdown();
  }, [slug]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 z-50 flex justify-center items-center px-4">
      <div className="bg-white text-black p-6 rounded shadow-lg max-w-3xl w-full max-h-[80vh] overflow-y-auto relative">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-black font-bold border border-black px-2 py-1 rounded hover:bg-gray-200"
        >
          关闭
        </button>

        {/* Title and Excerpt */}
        <div className="mb-6">
          {title && (
            <h1 className="text-3xl font-bold text-center">{title}</h1>
          )}
          {excerpt && (
            <p className="text-xl italic text-center text-gray-600 mt-2">{excerpt}</p>
          )}
        </div>

        {loading ? (
          <p className="text-center">加载中...</p>
        ) : (
          <ReactMarkdown
            rehypePlugins={[rehypeRaw]}
            components={{
              h1: ({ children }) => <h1 className="text-2xl font-bold mb-4">{children}</h1>,
              h2: ({ children }) => <h2 className="text-xl font-semibold mb-3">{children}</h2>,
              h3: ({ children }) => <h3 className="text-lg font-semibold mb-2">{children}</h3>,
              h4: ({ children }) => <h4 className="text-base font-semibold mb-1.5">{children}</h4>,
              h5: ({ children }) => <h5 className="text-sm font-semibold mb-1">{children}</h5>,
              h6: ({ children }) => <h6 className="text-xs font-semibold mb-1 text-gray-600 uppercase tracking-wider">{children}</h6>,
              p: ({ children }) => <p className="mb-3 leading-relaxed">{children}</p>,
              ul: ({ children }) => <ul className="list-disc ml-5 mb-3">{children}</ul>,
              ol: ({ children }) => <ol className="list-decimal ml-5 mb-3">{children}</ol>,
              li: ({ children }) => <li className="mb-1">{children}</li>,
              code: ({ children, className }) => {
                // 如果是代码块里的 code，交给 pre 渲染，这里只处理行内 code
                const isInline = !className;
                return isInline ? (
                  <code className="bg-gray-100 text-black px-1 py-0.5 rounded text-sm font-mono">
                    {children}
                  </code>
                ) : (
                  <code className={className}>{children}</code>
                );
              },
              pre: ({ children }) => (
                <pre className="bg-gray-900 text-white p-4 rounded overflow-x-auto mb-4">
                  {children}
                </pre>
              ),
              blockquote: ({ children }) => (
                <blockquote className="border-l-4 border-gray-400 pl-4 italic text-gray-700 mb-3">
                  {children}
                </blockquote>
              ),
              a: ({ href, children }) => (
                <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">
                  {children}
                </a>
              ),
              font: ({ color, children }) => (
                <span style={{ color }}>{children}</span>
              ),
            }}
          >
            {markdown}
          </ReactMarkdown>
        )}
      </div>
    </div>
  );
}