import MainSectionPage from '@/app/main-section/MainSectionPage';

export default async function BlogPage({ params }) {
  const { section } = params;
  return <MainSectionPage section_name={section} />;
}
