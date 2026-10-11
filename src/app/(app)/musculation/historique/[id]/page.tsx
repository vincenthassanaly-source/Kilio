import { connection } from "next/server";
import { EntrainementDetailView } from "./EntrainementDetailView";

export default async function EntrainementPage({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await params;
  return <EntrainementDetailView id={id} />;
}
