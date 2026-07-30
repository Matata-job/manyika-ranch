"use client";

import Link from "next/link";
import { useT } from "@/components/providers/locale-provider";

interface PedigreeNode {
  id: string;
  eartag: string;
  breed: string;
  sex: string;
  sire?: PedigreeNode | null;
  dam?: PedigreeNode | null;
}

interface OffspringNode {
  id: string;
  eartag: string;
  breed: string;
  sex: string;
  dob?: string | null;
  status?: string;
  via?: string;
  offspring?: OffspringNode[];
}

export function PedigreeTree({
  node,
  depth = 0,
}: {
  node: Record<string, unknown>;
  depth?: number;
}) {
  const n = node as unknown as PedigreeNode;
  if (depth > 3) return null;

  return (
    <div className="space-y-2">
      <div
        className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"
        style={{ marginLeft: depth * 24 }}
      >
        <Link href={`/animals/${n.id}`} className="font-bold text-primary hover:underline">
          {n.eartag}
        </Link>
        <span className="text-muted-foreground">{n.breed}</span>
        <span className="text-xs bg-muted px-1.5 py-0.5 rounded">{n.sex}</span>
      </div>
      {(n.sire || n.dam) && (
        <div className="space-y-1">
          {n.sire && (
            <div>
              <p className="text-xs text-muted-foreground ml-4">Sire</p>
              <PedigreeTree
                node={n.sire as unknown as Record<string, unknown>}
                depth={depth + 1}
              />
            </div>
          )}
          {n.dam && (
            <div>
              <p className="text-xs text-muted-foreground ml-4">Dam</p>
              <PedigreeTree
                node={n.dam as unknown as Record<string, unknown>}
                depth={depth + 1}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function OffspringTree({
  nodes,
  depth = 0,
}: {
  nodes: OffspringNode[];
  depth?: number;
}) {
  const t = useT();
  if (!nodes?.length) {
    return (
      <p className="text-sm text-muted-foreground">{t("noOffspring")}</p>
    );
  }

  return (
    <div className="space-y-2">
      {nodes.map((child) => (
        <div key={child.id}>
          <div
            className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"
            style={{ marginLeft: depth * 24 }}
          >
            <Link
              href={`/animals/${child.id}`}
              className="font-bold text-primary hover:underline"
            >
              {child.eartag}
            </Link>
            <span className="text-muted-foreground">{child.breed}</span>
            <span className="text-xs bg-muted px-1.5 py-0.5 rounded">
              {child.sex === "MALE" ? t("male") : t("female")}
            </span>
            {child.dob && (
              <span className="text-xs text-muted-foreground">
                {String(child.dob).slice(0, 10)}
              </span>
            )}
          </div>
          {child.offspring && child.offspring.length > 0 && (
            <div className="mt-1">
              <OffspringTree nodes={child.offspring} depth={depth + 1} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
