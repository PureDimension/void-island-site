'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import sectionsConfig from '../../config/sections_config.json';
import BlogModal from '../../components/BlogModal'; // 注意路径是否正确


export default function MainSectionPage({ section_name }) {
  const [posts, setPosts] = useState([]);
  const [selectedKeyword, setSelectedKeyword] = useState(null);
  const [description, setDescription] = useState('');
  const [titleOff, setTitleOff] = useState('');
  const [modalSlug, setModalSlug] = useState(null);


  // 默认描述
  const defaultDescription = `这是一个默认描述，如果你看到这个说明标题配置加载失败。`;

  // 加载标题配置
  useEffect(() => {
    // 查找匹配的栏目并设置描述
    const section = sectionsConfig.mainSections.find(item => item.title === section_name);
    if (section) {
      setDescription(section.description);
      setTitleOff(section.titleOff); // 获取titleOff值
    } else {
      setDescription(defaultDescription);
      setTitleOff(defaultDescription); // 如果加载失败，设置默认值
    }
  }, [section_name]);

  useEffect(() => {
    async function fetchPosts() {
      const res = await fetch(`/api/read-posts?section=${section_name}`);
      const data = await res.json();
      setPosts(data);
    }
    fetchPosts();
  }, [section_name]);

  const allKeywords = [...new Set(posts.flatMap(post => post.keywords))];

  const filteredPosts = selectedKeyword
    ? posts.filter(post => post.keywords.includes(selectedKeyword))
    : posts;
  return (
    <main className="p-6 relative min-h-screen bg-black text-white">
      {/* 弹窗展示 markdown 内容 */}
      {modalSlug && (
        <BlogModal
          section={section_name}
          slug={modalSlug}
          onClose={() => setModalSlug(null)}
        />
      )}
      {/* 返回按钮 */}
      <div className="absolute top-4 right-4 z-10">
        <Link href="/">
          <button className="bg-white text-black px-3 py-1 font-bold rounded shadow-lg">返回</button>
        </Link>
      </div>

      {/* 索引栏 */}
      <div className="border-4 border-white p-4 mb-6 rounded max-w-lg mx-auto">
        <h2 className="text-xl font-bold mb-2">关键词索引</h2>
        <div className="flex flex-wrap gap-2">
          {allKeywords.map((kw) => (
            <button
              key={kw}
              onClick={() => setSelectedKeyword(kw === selectedKeyword ? null : kw)}
              className={`px-3 py-1 rounded font-bold border ${kw === selectedKeyword ? 'bg-white text-black' : 'bg-gray-700 border-white text-white'}`}
            >
              {kw}
            </button>
          ))}
        </div>
      </div>

      {/* 博客条目 */}
      <div className="flex flex-col gap-6 max-w-3xl mx-auto">
        {filteredPosts.map((post) => (
          <div key={post.slug} className="p-4 border border-gray-600 rounded bg-gray-800 shadow-xl hover:shadow-2xl transition-all duration-300">
            <h3 className="text-2xl font-bold mb-1">{post.title}</h3>
            <p className="text-sm text-gray-400 mb-2">{post.date}</p>
            <p className="text-base text-white line-clamp-3 mb-2">{post.excerpt}</p>

            <div className="flex flex-wrap gap-2 mb-2">
              {post.keywords.map((kw, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedKeyword(kw === selectedKeyword ? null : kw)}
                  className="text-sm font-bold px-2 py-1 rounded bg-white text-black hover:bg-yellow-200 transition"
                >
                  {kw}
                </button>
              ))}
            </div>
            {/* 将 Link 包裹移除，只保留按钮点击打开弹窗 */}
            <button
              onClick={() => setModalSlug(post.slug)}
              className="text-blue-400 mt-2 inline-block hover:underline"
            >
              阅读全文
            </button>
          </div>
        ))}

        {/* 到底了 */}
        <div className="text-center text-gray-400 text-sm mt-6">—— 到底了 ——</div>
      </div>


      {/* 右下角栏目介绍 */}
      <div className="fixed bottom-4 right-6 bg-gray-700 text-white border-4 border-white p-6 max-w-xs rounded shadow-lg">
        <h4 className="text-lg font-bold mb-2">{titleOff}</h4> {/* 使用titleOff作为栏目介绍标题 */}
        <p className="text-sm whitespace-pre-line">{description}</p>
      </div>
    </main>
  );
}
