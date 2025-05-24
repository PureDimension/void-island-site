"use client";
import Link from "next/link";
import sectionsConfig from "@/config/sections_config.json";
import BlogModal from "@/components/BlogModal";
import KeywordIndex from "@/components/KeywordIndex";
import BlogPostList from "@/components/BlogPostList";
import SectionDescription from "@/components/SectionDescription";
import ReturnMenus from "@/components/ReturnMenus";
import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTheme } from "@/lib/theme";

export default function MainSectionPage({ posts, section_name }) {
	const router = useRouter();
	const searchParams = useSearchParams();
	const [selectedTag, setSelectedTag] = useState(null);
	const [description, setDescription] = useState("");
	const [titleOff, setTitleOff] = useState("");
	const [themeColors, setThemeColors] = useState({
		bg1: "#000000",
		bg2: "#111111",
	});
	const [modalSlug, setModalSlug] = useState(null);
	const [isMobile, setIsMobile] = useState(false);
	const { isDarkMode } = useTheme();
	const playerHeight = isMobile ? 100 : 0;

	useEffect(() => {
		const urlSlug = searchParams.get("post");
		if (urlSlug) setModalSlug(urlSlug);
	}, [searchParams]);

	function handleSetModalSlug(slug) {
		if (slug) {
			router.replace(`?post=${encodeURIComponent(slug)}`, { scroll: false });
			setModalSlug(slug);
		} else {
			router.replace(`/blog/${section_name}`, { scroll: false });
			setModalSlug(null);
		}
	}

	const modalPost = modalSlug ? posts.find((p) => p.slug === modalSlug) : null;

	const defaultDescription = `这是一个默认描述，如果你看到这个说明标题配置加载失败。`;

	useEffect(() => {
		const section = sectionsConfig.mainSections.find(
			(item) => item.title === section_name
		);
		if (section) {
			setDescription(section.description);
			setTitleOff(section.titleOff);
			setThemeColors(section.themeColors || { bg1: "#000", bg2: "#111" });
		} else {
			setDescription(defaultDescription);
			setTitleOff(defaultDescription);
		}
	}, [section_name]);

	useEffect(() => {
		function handleResize() {
			setIsMobile(window.innerWidth <= 768);
		}
		handleResize();
		window.addEventListener("resize", handleResize);
		return () => window.removeEventListener("resize", handleResize);
	}, []);

	const allTags = [...new Set(posts.flatMap((post) => post.tags))];
	const filteredPosts = selectedTag
		? posts.filter((post) => post.tags.includes(selectedTag))
		: posts;
  
	return (
		<main
		className="p-6 relative min-h-screen text-white"
		style={{
		  paddingBottom: `${playerHeight}px`,
		  backgroundImage: `repeating-linear-gradient(
			160deg,
			${themeColors.bg1},
			${themeColors.bg1} 60px,
			${themeColors.bg2} 60px,
			${themeColors.bg2} 120px
		  )`,
		  transition: "background-color 0.5s ease",
		  position: "relative",
		}}
	  >
			{/* 遮罩层 */}
			<div
			style={{
				position: "absolute",
				inset: 0,
				backgroundColor: "#0a0a0a",
				opacity: isDarkMode ? 1 : 0,
				pointerEvents: "none",
				transition: "opacity 0.5s ease",
				zIndex: 0,
			}}
			/>
			{modalPost && (
				<BlogModal
					title={modalPost.title}
					excerpt={modalPost.excerpt}
					content={modalPost.content}
					onClose={() => handleSetModalSlug(null)}
					isMobile={isMobile}
				/>
			)}
			<ReturnMenus />
			<KeywordIndex
				allTags={allTags}
				selectedTag={selectedTag}
				setSelectedTag={setSelectedTag}
			/>
			{isMobile && (
				<SectionDescription
					titleOff={titleOff}
					description={description}
					mobile={true}
				/>
			)}
			<BlogPostList
				posts={filteredPosts}
				selectedTag={selectedTag}
				setSelectedTag={setSelectedTag}
				setModalSlug={handleSetModalSlug}
				postBackground={'rgba(0, 0, 0, 0.5)'} // 未来再改成配置文件
			/>
			{!isMobile && (
				<SectionDescription
					titleOff={titleOff}
					description={description}
					mobile={false}
				/>
			)}
		</main>
	);
}
