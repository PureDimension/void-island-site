"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useFilter } from "@/components/FilterContext";
import TopRightButton from "@/components/TopRightButton";
import Link from "next/link";
import sectionsConfig from "@/config/sections_config.json";
import BlogModal from "@/components/BlogModal";
import SelfIntroduction from "@/components/SelfIntroduction";

export default function HomeContent({ selfIntroPosts, headlinePosts }) {
  const { filterOn } = useFilter();
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const [isMobile, setIsMobile] = useState(false);
  const modalSlug = searchParams.get("post");
  const openModal = (slug) => {
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set("post", slug);
    router.replace(`/?${nextParams.toString()}`, { scroll: false });
  };
  const closeModal = () => {
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.delete("post");
    const queryString = nextParams.toString();
    router.replace(queryString ? `/?${queryString}` : `/`, { scroll: false });
  };

  const didMount = useRef(false);
  const [animatedTitles, setAnimatedTitles] = useState([]);

  useEffect(() => {
    function handleResize() {
      setIsMobile(window.innerWidth <= 768);
    }
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (pathname === "/") {
      didMount.current = false;
    }
  }, [pathname]);

  useEffect(() => {
    const newTitles = sectionsConfig.mainSections.map((item) => ({
      text: filterOn ? item.titleOn : item.titleOff,
      color: item.color,
      link: "/blog/" + item.title,
    }));

    if (!didMount.current) {
      setAnimatedTitles(newTitles.map((item) => ({ ...item, visible: true })));
      didMount.current = true;
      return;
    }

    setAnimatedTitles((prev) =>
      prev.map((item) => ({ ...item, visible: false }))
    );

    const timeout = setTimeout(() => {
      setAnimatedTitles(newTitles.map((item) => ({ ...item, visible: true })));
    }, 200);

    return () => clearTimeout(timeout);
  }, [filterOn]);

  const selectedPost = selfIntroPosts.find((p) => p.slug === modalSlug);

  return (
    <div className="min-h-screen relative overflow-hidden text-white">
      {/* 背景层 1 (原 filterOn=true 时的背景) */}
      <div
        className="absolute inset-0 transition-opacity duration-300"
        style={{
          background: "linear-gradient(135deg,rgb(151, 139, 123),rgb(79, 97, 125))",
          opacity: filterOn ? 1 : 0,
          zIndex: 0,
        }}
      />
      {/* 背景层 2 (原 filterOn=false 时的背景) */}
      <div
        className="absolute inset-0 transition-opacity duration-300"
        style={{
          background: "linear-gradient(135deg,rgb(249, 235, 215),rgb(175, 205, 254))",
          opacity: filterOn ? 0 : 1,
          zIndex: 0,
        }}
      />

      {/* 内容层，确保在背景之上 */}
      <main
        className="relative z-10"
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          paddingTop: "100px",
          paddingBottom: isMobile ? "80px" : "0px",
        }}
      >
        {modalSlug && selectedPost && (
          <BlogModal
            title={selectedPost.title}
            excerpt={selectedPost.excerpt}
            content={selectedPost.content}
            encrypted={selectedPost.encrypted}
            verify={selectedPost.verify}
            salt={selectedPost.salt}
            iv={selectedPost.iv}
            iterations={selectedPost.iterations}
            onClose={closeModal}
            isMobile={isMobile}
            forceTheme={filterOn}
          />
        )}
        <TopRightButton isMobile={isMobile} />

        <SelfIntroduction
          isMobile={isMobile}
          sectionsConfig={sectionsConfig}
          openModal={openModal}
        />

        <div
          style={{
            paddingTop: isMobile ? "15px" : "0px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
            fontSize: "2.5rem",
            fontWeight: "bold",
            textShadow: "2px 2px 5px #000",
            marginBottom: "2rem",
          }}
        >
          {animatedTitles.map((item, idx) => (
            <div
              key={idx}
              style={{
                color: item.color,
                opacity: item.visible ? 1 : 0,
                transform: item.visible ? "translateX(0)" : "translateX(20px)",
                transition: "all 0.3s ease-in-out",
              }}
            >
              <Link href={item.link}>{item.text}</Link>
            </div>
          ))}
        </div>

        <div
          style={{
            fontSize: "1rem",
            textAlign: "center",
            lineHeight: "1.8",
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            padding: "20px",
            borderRadius: "10px",
            fontWeight: "bold",
            maxWidth: "600px",
          }}
        >
          {sectionsConfig.subProjects.map((project, idx) => (
            <div key={idx} style={{ color: project.color }}>
              {project.ID ? (
                <Link
                  href={`/project/${project.ID}`}
                  className="inline-block text-current hover:text-gray-100 underline cursor-pointer transition-colors duration-200"
                >
                  - {project.title}：{project.description} -
                </Link>
              ) : (
                <>- {project.title}：{project.description} -</>
              )}
            </div>
          ))}
        </div>

        <div
          style={{
            position: isMobile ? "static" : "fixed",
            bottom: isMobile ? "auto" : "20px",
            right: isMobile ? "auto" : "20px",
            backgroundColor: "rgba(100, 100, 100, 0.9)",
            color: "white",
            padding: "15px 20px",
            borderRadius: "10px",
            border: "3px solid white",
            fontWeight: "bold",
            maxWidth: "300px",
            zIndex: 2,
            wordWrap: "break-word",
            textAlign: "center",
            boxShadow: "0 4px 8px rgba(0,0,0,0.2)",
          }}
          className="headline-box"
        >
          <div style={{ textAlign: "center", marginBottom: "20px" }}>
            <h1 style={{ whiteSpace: "pre-line", fontSize: "1.5em" }}>
              系统公告📢
            </h1>
            <h1 style={{ whiteSpace: "pre-line" }}>
              {sectionsConfig.headline.description}
            </h1>
          </div>
          <div
            style={{ textAlign: "center", marginBottom: "20px", fontSize: "1.5em" }}
          >
            <h1>实时更新⌚</h1>
          </div>
          {headlinePosts.map((post, index) => (
            <div key={index} style={{ marginBottom: "10px", textAlign: "left" }}>
              <div style={{ fontSize: "0.85em", opacity: 0.85 }}>
                {post.date}｜{post.section}
              </div>
              <div style={{ fontSize: "1em" }}>
                {post.section === "self-introduction" ? (
                  <a
                    href={`/?post=${post.slug}`}
                    onClick={(e) => {
                      e.preventDefault();
                      openModal(post.slug);
                    }}
                    style={{ color: "#fff", textDecoration: "underline" }}
                  >
                    {post.title}
                  </a>
                ) : (
                  <a
                    href={`/blog/${post.section}?post=${post.slug}`}
                    style={{ color: "#fff", textDecoration: "underline" }}
                  >
                    {post.title}
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
