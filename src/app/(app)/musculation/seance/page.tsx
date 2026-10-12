import { connection } from "next/server";
import { SeanceView } from "./SeanceView";

export default async function SeancePage() {
  await connection();
  return <SeanceView />;
}
