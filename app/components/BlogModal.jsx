'use client';

import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw'; // 引入 rehype-raw 插件

export default function BlogModal({ section, slug, onClose, isMobile }) {
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
    <div
      className="fixed inset-0 z-50 flex justify-center items-center px-4"
      style={{
        backgroundColor: "rgba(0, 0, 0, 0.3)", // 设置背景为稍微变黑的透明效果
      }}
      onClick={onClose} // 点击背景时关闭弹窗
    >
      {/* 外层容器，包含返回按钮和滚动弹窗 */}
      <div
      className="relative bg-white rounded shadow-lg"
      style={{
        width: isMobile ? "90%" : "700px", // 弹窗宽度
        height: `calc(100vh - 140px)`, // 高度为视口高度减去上下留白（20px + 120px）
        marginTop:  "40px",
        marginBottom: "100px",
        overflow: "hidden", // 确保内容不会溢出
        border: "5px solid gray", // 黑色外框
      }}
      onClick={(e) => e.stopPropagation()} // 阻止点击弹窗内容区域触发关闭事件
    >
        {/* 返回按钮 */}
        <button
          onClick={onClose}
          className="absolute flex items-center justify-center rounded-full shadow-lg"
          style={{
            position: "absolute", // 按钮绝对定位
            top: "16px", // 距离容器顶部 16px
            right: "16px", // 距离容器右侧 16px
            width: "32px", // 按钮宽度
            height: "32px", // 按钮高度
            fontSize: "16px", // 字体大小
            fontWeight: "bold", // 加粗字体
            color: "black", // "X" 的颜色
            backgroundColor: "rgba(0, 0, 0, 0)", // 透明背景
            border: "2px solid black", // 黑色外框
            cursor: "pointer", // 鼠标悬停时显示手型
            transition: "background-color 0.3s ease", // 背景色过渡效果
            zIndex: 10, // 确保按钮在弹窗内容之上
          }}
          onMouseEnter={(e) =>
            (e.target.style.backgroundColor = "rgba(0, 0, 0, 0.1)")
          } // 悬浮时背景变灰
          onMouseLeave={(e) =>
            (e.target.style.backgroundColor = "rgba(0, 0, 0, 0)")
          } // 离开时恢复透明背景
        >
          X
        </button>

        {/* 滚动弹窗内容 */}
        <div
          className="bg-white text-black p-6 overflow-y-auto"
          style={{
            width: "100%", // 占满外层容器宽度
            height: "100%", // 占满外层容器高度
            boxSizing: "border-box", // 确保内边距不会影响宽高
          }}
        >
          {/* Title and Excerpt */}
          <div className="mb-6">
            {title && <h1 className="text-3xl font-bold text-center">{title}</h1>}
            {excerpt && (
              <p className="text-xl italic text-center text-gray-600 mt-2">
                {excerpt}
              </p>
            )}
          </div>

          {loading ? (
            <p className="text-center">加载中...</p>
          ) : (
            <ReactMarkdown
              rehypePlugins={[rehypeRaw]}
              components={{
                h1: ({ children }) => (
                  <h1 className="text-2xl font-bold mb-4">{children}</h1>
                ),
                h2: ({ children }) => (
                  <h2 className="text-xl font-semibold mb-3">{children}</h2>
                ),
                h3: ({ children }) => (
                  <h3 className="text-lg font-semibold mb-2">{children}</h3>
                ),
                h4: ({ children }) => (
                  <h4 className="text-base font-semibold mb-1.5">{children}</h4>
                ),
                h5: ({ children }) => (
                  <h5 className="text-sm font-semibold mb-1">{children}</h5>
                ),
                h6: ({ children }) => (
                  <h6 className="text-xs font-semibold mb-1 text-gray-600 uppercase tracking-wider">
                    {children}</h6>
                ),
                p: ({ children }) => (
                  <p className="mb-3 leading-relaxed">{children}</p>
                ),
                ul: ({ children }) => (
                  <ul className="list-disc ml-5 mb-3">{children}</ul>
                ),
                ol: ({ children }) => (
                  <ol className="list-decimal ml-5 mb-3">{children}</ol>
                ),
                li: ({ children }) => <li className="mb-1">{children}</li>,
                code: ({ children, className }) => {
                  const isInline = !className;
                  return isInline ? (
                    <code className="bg-gray-100 text-black px-1 py-0.5 rounded text-sm font-mono">
                      {children}</code>
                  ) : (
                    <code className={className}>{children}</code>
                  );
                },
                pre: ({ children }) => (
                  <pre className="bg-gray-900 text-white p-4 rounded overflow-x-auto mb-4">
                    {children}</pre>
                ),
                blockquote: ({ children }) => (
                  <blockquote className="border-l-4 border-gray-400 pl-4 italic text-gray-700 mb-3">
                    {children}</blockquote>
                ),
                a: ({ href, children }) => (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 underline"
                  >
                    {children}</a>
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
    </div>
  );
}