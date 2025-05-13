import { getPostsBySection } from "@/lib/posts";
import MainSectionPage from "@/app/MainSectionPage";

export default async function BlogPage({ params }) {
	const { section } = params;
	const posts = getPostsBySection(section);

	return <MainSectionPage posts={posts} section_name={section} />;
}
