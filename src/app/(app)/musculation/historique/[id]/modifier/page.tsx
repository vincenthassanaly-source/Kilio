import { connection } from "next/server";
import { EditionEntrainement } from "../../EditionEntrainement";

export default async function ModifierEntrainementPage({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await params;
  return <EditionEntrainement id={id} />;
}
