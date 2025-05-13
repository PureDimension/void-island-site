import { getPostsBySection } from "@/lib/posts";
import HomeContent from "./HomeContent";
import getRecentBlogMetadata from "@/lib/RecentBlogMetadata";

export default function HomePage() {
	const selfIntroPosts = getPostsBySection("self-introduction");
	const recentPosts = getRecentBlogMetadata();
	return <HomeContent selfIntroPosts={selfIntroPosts} headlinePosts={recentPosts} />;
}
