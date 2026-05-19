import HomeWorkspaces, { type HomeBoard } from "./home-workspaces";

export const dynamic = "force-dynamic";

export default async function Home() {
  const res = await fetch("http://127.0.0.1:5000/api/boards");
  const boards = (await res.json()) as HomeBoard[];

  return <HomeWorkspaces initialBoards={boards} />;
}
