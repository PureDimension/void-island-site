"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import sectionsConfig from "../config/sections_config.json";
import BlogModal from "./components/BlogModal";
import KeywordIndex from "./components/KeywordIndex";
import BlogPostList from "./components/BlogPostList";
import SectionDescription from "./components/SectionDescription";
import ReturnButton from "./components/ReturnButton";

export default function MainSectionPage({ section_name }) {
	const [posts, setPosts] = useState([]);
	const [selectedTag, setSelectedTag] = useState(null);
	const [description, setDescription] = useState("");
	const [titleOff, setTitleOff] = useState("");
	const [modalSlug, setModalSlug] = useState(null);
	const [isMobile, setIsMobile] = useState(false); // 检测是否为手机端
	const playerHeight = isMobile ? 100 : 0; // 手机端预留 100px 高度，桌面端不预留

	// 默认描述
	const defaultDescription = `这是一个默认描述，如果你看到这个说明标题配置加载失败。`;

	// 加载标题配置
	useEffect(() => {
		// 查找匹配的栏目并设置描述
		const section = sectionsConfig.mainSections.find(
			(item) => item.title === section_name
		);
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

	// 检测是否为手机端
	useEffect(() => {
		function handleResize() {
			setIsMobile(window.innerWidth <= 768); // 判断屏幕宽度是否小于等于768px
		}
		handleResize(); // 初始化时调用一次
		window.addEventListener("resize", handleResize); // 监听窗口大小变化
		return () => window.removeEventListener("resize", handleResize); // 清理事件监听器
	}, []);

	const allTags = [...new Set(posts.flatMap((post) => post.tags))];

	const filteredPosts = selectedTag
		? posts.filter((post) => post.tags.includes(selectedTag))
		: posts;

	return (
		<main
			className="p-6 relative min-h-screen bg-black text-white"
			style={{
				paddingBottom: `${playerHeight}px`,
			}}
		>
			{/* 弹窗展示 markdown 内容 */}
			{modalSlug && (
				<BlogModal
					section={section_name}
					slug={modalSlug}
					onClose={() => setModalSlug(null)}
				/>
			)}
			{/* 返回按钮 */}
			<ReturnButton />

			{/* 索引栏 */}
			<KeywordIndex
				allTags={allTags}
				selectedTag={selectedTag}
				setSelectedTag={setSelectedTag}
			/>

			{/* 栏目介绍（在手机端放在索引栏和博客条目之间） */}
			{isMobile && (
				<SectionDescription
					titleOff={titleOff}
					description={description}
					mobile={true}
				/>
			)}

			{/* 博客条目 */}
			<BlogPostList
				posts={filteredPosts}
				selectedTag={selectedTag}
				setSelectedTag={setSelectedTag}
				setModalSlug={setModalSlug}
			/>

			{/* 右下角栏目介绍（仅在桌面端显示） */}
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
