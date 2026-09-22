import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: Request) {
  const category = new URL(req.url).searchParams.get("category");
  const templates = await prisma.challengeTemplate.findMany({
    where: category ? { category } : undefined,
    orderBy: [{ timesUsed: "desc" }, { difficultyElo: "desc" }],
  });
  return NextResponse.json({ templates });
}
