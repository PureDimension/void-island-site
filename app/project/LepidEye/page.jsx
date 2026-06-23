import MainProjectPage from "./MainProjectPage";
import { getProjectByID } from "@/lib/projects";
import { getLepidEyeBootstrap, resolveLepidEyeAccess } from "@/lib/server/lepidEye";

export default async function LepidEyePage({ searchParams }) {
  const projects = getProjectByID("LepidEye") || [];
  const resolvedSearchParams = await searchParams;
  const requestKey = typeof resolvedSearchParams?.key === "string" ? resolvedSearchParams.key : "";
  const access = resolveLepidEyeAccess(requestKey);
  const accessLevel = access.accessLevel;
  const bootstrap = getLepidEyeBootstrap({ accessLevel });

  return <MainProjectPage projects={projects} bootstrap={bootstrap} editorKey={access.editorKey} viewerName={access.viewerName} />;
}
