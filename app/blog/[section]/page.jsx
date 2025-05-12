import MainSectionPage from "@/app/MainSectionPage";

export default async function BlogPage(props) {
	const { section } = await props.params;
	return <MainSectionPage section_name={section} />;
}
