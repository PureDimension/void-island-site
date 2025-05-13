"use client";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw"; // 引入 rehype-raw 插件

export default function BlogModal({ title, excerpt, content, onClose }) {
	return (
		<div className="fixed inset-0 bg-black bg-opacity-70 z-50 flex justify-center items-center px-4">
			<div className="bg-white text-black p-6 rounded shadow-lg max-w-3xl w-full max-h-[80vh] overflow-y-auto relative">
				<button
					onClick={onClose}
					className="absolute top-3 right-3 text-black font-bold border border-black px-2 py-1 rounded hover:bg-gray-200"
				>
					关闭
				</button>

				{/* Title and Excerpt */}
				<div className="mb-6">
					{title && <h1 className="text-3xl font-bold text-center">{title}</h1>}
					{excerpt && (
						<p className="text-xl italic text-center text-gray-600 mt-2">
							{excerpt}
						</p>
					)}
				</div>

				<ReactMarkdown
					rehypePlugins={[rehypeRaw]}
					components={{
						h1: ({ children }) => (
							<h1 className="text-2xl font-bold mb-4">{children}</h1>
						),
						h2: ({ children }) => (
							<h2 className="text-xl font-semibold mb-3">{children}</h2>
						),
						h3: ({ children }) => (
							<h3 className="text-lg font-semibold mb-2">{children}</h3>
						),
						h4: ({ children }) => (
							<h4 className="text-base font-semibold mb-1.5">{children}</h4>
						),
						h5: ({ children }) => (
							<h5 className="text-sm font-semibold mb-1">{children}</h5>
						),
						h6: ({ children }) => (
							<h6 className="text-xs font-semibold mb-1 text-gray-600 uppercase tracking-wider">
								{children}
							</h6>
						),
						p: ({ children }) => (
							<p className="mb-3 leading-relaxed">{children}</p>
						),
						ul: ({ children }) => (
							<ul className="list-disc ml-5 mb-3">{children}</ul>
						),
						ol: ({ children }) => (
							<ol className="list-decimal ml-5 mb-3">{children}</ol>
						),
						li: ({ children }) => <li className="mb-1">{children}</li>,
						code: ({ children, className }) => {
							const isInline = !className;
							return isInline ? (
								<code className="bg-gray-100 text-black px-1 py-0.5 rounded text-sm font-mono">
									{children}
								</code>
							) : (
								<code className={className}>{children}</code>
							);
						},
						pre: ({ children }) => (
							<pre className="bg-gray-900 text-white p-4 rounded overflow-x-auto mb-4">
								{children}
							</pre>
						),
						blockquote: ({ children }) => (
							<blockquote className="border-l-4 border-gray-400 pl-4 italic text-gray-700 mb-3">
								{children}
							</blockquote>
						),
						a: ({ href, children }) => (
							<a
								href={href}
								target="_blank"
								rel="noopener noreferrer"
								className="text-blue-600 underline"
							>
								{children}
							</a>
						),
						font: ({ color, children }) => (
							<span style={{ color }}>{children}</span>
						),
					}}
				>
					{content}
				</ReactMarkdown>
			</div>
		</div>
	);
}
