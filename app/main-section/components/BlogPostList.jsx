export default function BlogPostList({
	posts,
	selectedTag,
	setSelectedTag,
	setModalSlug,
}) {
	return (
		<div className="flex flex-col gap-6 max-w-3xl mx-auto">
			{posts.map((post) => (
				<div
					key={post.slug}
					className="p-4 border border-gray-600 rounded bg-gray-800 shadow-xl hover:shadow-2xl transition-all duration-300"
				>
					<h3 className="text-2xl font-bold mb-1">{post.title}</h3>
					<p className="text-sm text-gray-400 mb-2">{post.date}</p>
					<p className="text-base text-white line-clamp-3 mb-2">
						{post.excerpt}
					</p>
					<div className="flex flex-wrap gap-2 mb-2">
						{post.tags.map((kw, idx) => (
							<button
								key={idx}
								onClick={() => setSelectedTag(kw === selectedTag ? null : kw)}
								className="text-sm font-bold px-2 py-1 rounded bg-white text-black hover:bg-yellow-200 transition"
							>
								{kw}
							</button>
						))}
					</div>
					<button
						onClick={() => setModalSlug(post.slug)}
						className="text-blue-400 mt-2 inline-block hover:underline"
					>
						阅读全文
					</button>
				</div>
			))}
			<div className="text-center text-gray-400 text-sm mt-6">—— 到底了 ——</div>
		</div>
	);
}
