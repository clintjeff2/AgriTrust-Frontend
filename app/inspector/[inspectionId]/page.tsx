import { InspectionDetail } from "@/src/pages/inspector/InspectionDetail";

interface PageProps { params: Promise<{ inspectionId: string }> | { inspectionId: string }; }

export default async function InspectorInspectionPage({ params }: PageProps) {
  const resolvedParams = await params;
  return <InspectionDetail inspectionId={resolvedParams.inspectionId} />;
}
