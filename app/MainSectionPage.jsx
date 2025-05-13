"use client";
import Link from "next/link";
import sectionsConfig from "../config/sections_config.json";
import BlogModal from "./components/BlogModal";
import KeywordIndex from "./components/KeywordIndex";
import BlogPostList from "./components/BlogPostList";
import SectionDescription from "./components/SectionDescription";
import ReturnButton from "./components/ReturnButton";
import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function MainSectionPage({ posts, section_name }) {
	const router = useRouter();
	const searchParams = useSearchParams();
	const [selectedTag, setSelectedTag] = useState(null);
	const [description, setDescription] = useState("");
	const [titleOff, setTitleOff] = useState("");
	const [modalSlug, setModalSlug] = useState(null);
	const [isMobile, setIsMobile] = useState(false);
	const playerHeight = isMobile ? 100 : 0;

	// 打开页面时根据url参数自动弹窗
	useEffect(() => {
		const urlSlug = searchParams.get("post");
		if (urlSlug) setModalSlug(urlSlug);
	}, [searchParams]);

	// 打开弹窗时更新url，关闭时恢复
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
			className="p-6 relative min-h-screen bg-black text-white"
			style={{ paddingBottom: `${playerHeight}px` }}
		>
			{modalPost && (
				<BlogModal
					title={modalPost.title}
					excerpt={modalPost.excerpt}
					content={modalPost.content}
					onClose={() => handleSetModalSlug(null)}
				/>
			)}
			<ReturnButton />
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
