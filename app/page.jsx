"use client";
import { useEffect, useState } from "react";
import { useFilter } from "./components/FilterContext";
import TopRightButton from "./components/TopRightButton";
import Link from "next/link";
import sectionsConfig from "../config/sections_config.json";
import MusicPlayer from "./components/MusicPlayer";

export default function Home() {
	const { filterOn } = useFilter();
	const [isMobile, setIsMobile] = useState(false);
	const playerHeight = isMobile ? 80 : 0;

	const [animatedTitles, setAnimatedTitles] = useState(
		sectionsConfig.mainSections.map((item) => ({
			text: filterOn ? item.titleOn : item.titleOff,
			color: item.color,
			visible: true,
			link: "/blog/" + item.title,
		}))
	);

	useEffect(() => {
		function handleResize() {
			setIsMobile(window.innerWidth <= 768);
		}
		handleResize();
		window.addEventListener("resize", handleResize);
		return () => window.removeEventListener("resize", handleResize);
	}, []);

	useEffect(() => {
		const newTitles = sectionsConfig.mainSections.map((item) => ({
			text: filterOn ? item.titleOn : item.titleOff,
			color: item.color,
			link: "/blog/" + item.title,
		}));

		setAnimatedTitles((prev) =>
			prev.map((item) => ({ ...item, visible: false }))
		);

		const timeout = setTimeout(() => {
			setAnimatedTitles(newTitles.map((item) => ({ ...item, visible: true })));
		}, 100);

		return () => clearTimeout(timeout);
	}, [filterOn]);

	return (
		<main
			style={{
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
				paddingTop: "100px",
				paddingBottom: `${playerHeight}px`,
			}}
		>
			<TopRightButton />
			<div
				style={{
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
							transform: item.visible ? "translateX(0)" : "20px",
							transition: item.visible
								? "opacity 0.3s ease-in-out"
								: "opacity 0.1s ease-in-out",
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
						- {project.title}：{project.description} -
					</div>
				))}
			</div>

			<div
				style={{
					position: "fixed",
					bottom: "20px",
					right: "20px",
					backgroundColor: "rgba(100, 100, 100, 0.9)",
					color: "white",
					padding: "15px 20px",
					borderRadius: "10px",
					border: "3px solid white",
					fontWeight: "bold",
					maxWidth: "300px",
					zIndex: 1000,
					wordWrap: "break-word",
					textAlign: "center",
					boxShadow: "0 4px 8px rgba(0,0,0,0.2)",
				}}
				className="headline-box"
			>
				<div style={{ textAlign: "center", marginBottom: "20px" }}>
					<div
						style={{
							display: "flex",
							justifyContent: "center",
							marginBottom: "10px",
						}}
					>
						<a
							href={sectionsConfig.headline.github}
							target="_blank"
							rel="noopener noreferrer"
						>
							<img
								src="/github.svg"
								alt="GitHub"
								style={{ width: "32px", height: "32px" }}
							/>
						</a>
					</div>
					<h1 style={{ whiteSpace: "pre-line" }}>
						{sectionsConfig.headline.title}
					</h1>
				</div>
			</div>
		</main>
	);
}
