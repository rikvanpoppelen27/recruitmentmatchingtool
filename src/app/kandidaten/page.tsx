import Link from "next/link";

import { Pagination } from "@/components/pagination";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { prisma } from "@/lib/db/prisma";

import { ContactEditForm } from "./contact-edit-form";
import { UploadDropzone } from "./upload-dropzone";

const PAGE_SIZE = 50;

interface KandidatenPageProps {
  searchParams: Promise<{ page?: string }>;
}

export default async function KandidatenPage({ searchParams }: KandidatenPageProps) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);

  const [total, candidates] = await Promise.all([
    prisma.candidate.count({ where: { isActive: true } }),
    prisma.candidate.findMany({
      where: { isActive: true },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        _count: { select: { matches: { where: { isPromising: true } } } },
      },
    }),
  ]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-neutral-900">Kandidaten</h1>
        <p className="mt-1 text-sm text-neutral-500">{total} kandidaat/kandidaten.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>CV's uploaden</CardTitle>
        </CardHeader>
        <CardContent>
          <UploadDropzone />
        </CardContent>
      </Card>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Naam</TableHead>
            <TableHead>Plaats</TableHead>
            <TableHead>Jaren ervaring</TableHead>
            <TableHead>Skills</TableHead>
            <TableHead>Contactgegevens</TableHead>
            <TableHead>Kansrijke matches</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {candidates.map((candidate) => (
            <TableRow key={candidate.id}>
              <TableCell>
                <Link href={`/kandidaten/${candidate.id}`} className="font-medium text-neutral-900 hover:underline">
                  {candidate.fullName ?? "Naam onbekend"}
                </Link>
              </TableCell>
              <TableCell>{candidate.region ?? "—"}</TableCell>
              <TableCell>{candidate.yearsExperience ?? "—"}</TableCell>
              <TableCell>{candidate.skills.length}</TableCell>
              <TableCell>
                <ContactEditForm candidateId={candidate.id} email={candidate.email} phone={candidate.phone} />
              </TableCell>
              <TableCell className="font-semibold">{candidate._count.matches}</TableCell>
            </TableRow>
          ))}
          {candidates.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="py-8 text-center text-neutral-400">
                Nog geen kandidaten. Upload hierboven een CV om te beginnen.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <Pagination page={page} pageCount={pageCount} buildHref={(p) => `/kandidaten?page=${p}`} />
    </div>
  );
}
