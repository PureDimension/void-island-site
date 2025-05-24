"use client";

import { FilterProvider, useFilter } from "@/components/FilterContext";
import "./globals.css";
import MusicPlayer from "@/components/MusicPlayer";
import { ThemeProvider } from "@/lib/theme";

function LayoutContent({ children }) {
	const { filterOn } = useFilter();

	return (
		<div
			style={{
				minHeight: "100vh",
				position: "relative",
				overflow: "hidden",
			}}
		>
			{/* 背景层 1 */}
			<div
				style={{
					position: "absolute",
					top: 0,
					left: 0,
					right: 0,
					bottom: 0,
					background:
						"linear-gradient(135deg,rgb(151, 139, 123),rgb(79, 97, 125))",
					opacity: filterOn ? 1 : 0,
					transition: "opacity 0.3s ease",
					zIndex: 0,
				}}
			/>
			{/* 背景层 2 */}
			<div
				style={{
					position: "absolute",
					top: 0,
					left: 0,
					right: 0,
					bottom: 0,
					background:
						"linear-gradient(135deg,rgb(249, 235, 215),rgb(175, 205, 254))",
					opacity: filterOn ? 0 : 1,
					transition: "opacity 0.3s ease",
					zIndex: 0,
				}}
			/>
			{/* 内容层 */}
			<div
				style={{
					position: "relative",
					zIndex: 1,
					color: "white",
				}}
			>
				{children}
			</div>
		</div>
	);
}

export default function Layout({ children }) {
	return (
		<html lang="en">
			<body>
				<FilterProvider>
					<ThemeProvider>
						<LayoutContent>
							{children}
						</LayoutContent>
					</ThemeProvider>
					<MusicPlayer /> {/* 始终悬浮的播放器组件 */}
				</FilterProvider>
			</body>
		</html>
	);
}
