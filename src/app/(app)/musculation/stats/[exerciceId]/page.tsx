import { connection } from "next/server";
import { FicheExercice } from "./FicheExercice";

export default async function FicheExercicePage({ params }: { params: Promise<{ exerciceId: string }> }) {
  await connection();
  const { exerciceId } = await params;
  return <FicheExercice exerciceId={exerciceId} />;
}
