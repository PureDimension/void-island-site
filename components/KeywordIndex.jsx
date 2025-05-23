
import { useTheme } from "@/lib/theme";

export default function KeywordIndex({ allTags, selectedTag, setSelectedTag }) {
	const { isDarkMode } = useTheme();
	return (
	  <div
		className="relative border-4 border-white p-4 mb-6 rounded max-w-lg mx-auto text-white shadow-lg"
		style={{
		  background: isDarkMode ? `#1f2937` : `rgba(0, 0, 0, 0.5)`,
		}}
	  >
		<h2 className="text-xl font-bold mb-2">关键词索引</h2>
		<div className="flex flex-wrap gap-2">
		  {allTags.map((kw) => (
			<button
			  key={kw}
			  onClick={() => setSelectedTag(kw === selectedTag ? null : kw)}
			  className={`px-3 py-1 rounded font-bold border ${
				kw === selectedTag
				  ? "bg-white text-black"
				  : "bg-gray-700 border-white text-white"
			  } hover:bg-gray-200 transition`}
			>
			  {kw}
			</button>
		  ))}
		</div>
	  </div>
	);
  }
  