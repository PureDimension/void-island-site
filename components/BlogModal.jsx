"use client";

import { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import { useTheme } from "@/lib/theme";

export default function BlogModal({ title, excerpt, content, onClose, isMobile }) {
  const modalRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [markdown, setMarkdown] = useState(content || "");

  // 支持点击遮罩关闭
  function handleMaskClick(e) {
    if (e.target === e.currentTarget) {
      onClose();
    }
  }

  // 解决手机浏览器出现顶部导航栏时，100vh不受影响，引起的跳变问题
  const [height, setHeight] = useState(0);
  const { isDarkMode } = useTheme();
  useEffect(() => {
    const updateHeight = () => {
      const fullHeight = window.innerHeight;
      const calcHeight = fullHeight - 140; // 对应你原来的 calc(100vh - 140px)
      setHeight(calcHeight);
    };

    updateHeight();
    window.addEventListener("resize", updateHeight);
    return () => window.removeEventListener("resize", updateHeight);
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex justify-center items-center px-4 backdrop-blur-sm bg-black/40"
      onClick={handleMaskClick}
      ref={modalRef}
    >
      <div
        className="relative bg-white rounded shadow-lg"
        style={{
          width: isMobile ? "90%" : "700px",
          height: `${height}px`,
          marginTop: "40px",
          marginBottom: "100px",
          overflow: "hidden",
          border: "5px solid gray",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 关闭按钮 */}
        <button
          onClick={onClose}
          className={`absolute top-4 right-4 flex items-center justify-center w-8 h-8 rounded-full border-2 ${isDarkMode? "border-white text-white hover:bg-gray-600" : "border-black text-black hover:bg-gray-200"} font-bold  transition`}
        >
          X
        </button>

        {/* 内容区域 */}
        <div className={`${isDarkMode? "bg-black text-white darkTheme-scrollbar" : "bg-white text-black"} p-6 overflow-y-auto h-full`}>
          {/* Title & Excerpt */}
          <div className="mb-6">
            {title && <h1 className="text-3xl font-bold text-center">{title}</h1>}
            {excerpt && (
              <p className={`text-xl italic text-center ${isDarkMode ? "text-gray-400" : "text-gray-600"} mt-2`}>{excerpt}</p>
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
                h6: ({ children }) => (
                  <h6 className="text-xs font-semibold mb-1 text-gray-600 uppercase tracking-wider">
                    {children}
                  </h6>
                ),
                p: ({ children }) => <p className="mb-3 leading-relaxed">{children}</p>,
                ul: ({ children }) => <ul className="list-disc ml-5 mb-3">{children}</ul>,
                ol: ({ children }) => <ol className="list-decimal ml-5 mb-3">{children}</ol>,
                li: ({ children }) => <li className="mb-1">{children}</li>,
                code: ({ children, className }) => {
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
                  <blockquote className={`border-l-4 border-gray-400 pl-4 italic ${isDarkMode ? "text-gray-300" : "text-gray-700"} mb-3`}>
                    {children}
                  </blockquote>
                ),
                a: ({ href, children }) => (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 underline"
                  >
                    {children}
                  </a>
                ),
                font: ({ color, children }) => <span style={{ color }}>{children}</span>,
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
