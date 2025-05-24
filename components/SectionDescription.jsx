import { useTheme } from "@/lib/theme";

export default function SectionDescription({ titleOff, description, mobile }) {
	const { isDarkMode } = useTheme();
	return mobile ? (
		<div className="bg-gray-700 text-white border-4 border-white p-6 mb-6 max-w-lg mx-auto rounded shadow-lg"
		style={{
			position: "relative", // ✅ 让 zIndex 生效
			background: isDarkMode ? `#1f2937` : `rgba(0, 0, 0, 0.5)`,
		}}
		>
			<h4 className="text-lg font-bold mb-2">{titleOff}</h4>
			<p className="text-sm whitespace-pre-line">{description}</p>
		</div>
	) : (
		<div className="fixed bottom-4 right-6 bg-gray-700 text-white border-4 border-white p-6 max-w-xs rounded shadow-lg"
		style={{
			background: isDarkMode ? `#1f2937` : `rgba(0, 0, 0, 0.5)`,
		}}
		>
			<h4 className="text-lg font-bold mb-2">{titleOff}</h4>
			<p className="text-sm whitespace-pre-line">{description}</p>
		</div>
	);
}
