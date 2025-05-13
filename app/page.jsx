import { getPostsBySection } from "@/lib/posts";
import HomeContent from "./HomeContent";

export default function HomePage() {
	const selfIntroPosts = getPostsBySection("self-introduction");
	return <HomeContent selfIntroPosts={selfIntroPosts} />;
}
