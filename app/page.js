'use client';
import { useEffect, useState } from 'react';
import { useFilter } from './FilterContext';
import TopRightButton from './TopRightButton';
import Link from 'next/link';  // 引入Link组件
import sectionsConfig from '../config/sections_config.json';
import MusicPlayer from '../components/MusicPlayer';
export default function Home() {
  const { filterOn } = useFilter();

  const [animatedTitles, setAnimatedTitles] = useState(
    sectionsConfig.mainSections.map((item) => ({
      text: filterOn ? item.titleOn : item.titleOff,
      color: item.color,
      visible: true,
      link: '/blog/'+item.title, // 添加链接属性
    }))
  );

  useEffect(() => {
    const newTitles = sectionsConfig.mainSections.map((item) => ({
      text: filterOn ? item.titleOn : item.titleOff,
      color: item.color,
      link: '/blog/'+item.title, // 添加链接属性
    }));

    setAnimatedTitles((prev) =>
      prev.map((item) => ({ ...item, visible: false }))
    );

    const timeout = setTimeout(() => {
      setAnimatedTitles(
        newTitles.map((item) => ({ ...item, visible: true }))
      );
    }, 100);

    return () => clearTimeout(timeout);
  }, [filterOn]);

  return (
    <main
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        paddingTop: '100px',
      }}
    >
        <TopRightButton />
      {/* 主条目 */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          fontSize: '2.5rem',
          fontWeight: 'bold',
          textShadow: '2px 2px 5px #000',
          marginBottom: '2rem',
        }}
      >
        {animatedTitles.map((item, idx) => (
          <div
            key={idx}
            style={{
              color: item.color,
              opacity: item.visible ? 1 : 0,
              transform: item.visible ? 'translateX(0)' : '20px',
              transition: item.visible
                ? 'opacity 0.3s ease-in-out'
                : 'opacity 0.1s ease-in-out',
            }}
          >
          {/* 在标题部分添加Link组件 */}
          <Link href={ item.link}>
            {item.text}
          </Link>
          </div>
        ))}
      </div>

      {/* 小条目 */}
      <div
        style={{
          fontSize: '1rem',
          textAlign: 'center',
          lineHeight: '1.8',
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          padding: '20px',
          borderRadius: '10px',
          fontWeight: 'bold',
          maxWidth: '600px',
        }}
      >
        {sectionsConfig.subProjects.map((project, idx) => (
          <div key={idx} style={{ color: project.color }}>
            - {project.title}：{project.description} -
          </div>
        ))}
      </div>

      {/* Headline 悬浮框 */}
      <div style={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        backgroundColor: 'rgba(100, 100, 100, 0.9)',
        color: 'white',
        padding: '15px 20px',
        borderRadius: '10px',
        border: '3px solid white',
        fontWeight: 'bold',
        maxWidth: '300px',
        zIndex: 1000,
        wordWrap: 'break-word',
        textAlign: 'center',
        boxShadow: '0 4px 8px rgba(0,0,0,0.2)'
      }}
        className="headline-box"
      >
        {sectionsConfig.headline.title}
      </div>

    </main>
  );
}
