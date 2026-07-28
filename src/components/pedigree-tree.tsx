interface PedigreeNode {
  id: string;
  eartag: string;
  breed: string;
  sex: string;
  sire?: PedigreeNode | null;
  dam?: PedigreeNode | null;
}

export function PedigreeTree({ node, depth = 0 }: { node: Record<string, unknown>; depth?: number }) {
  const n = node as unknown as PedigreeNode;
  if (depth > 3) return null;

  return (
    <div className="space-y-2">
      <div
        className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"
        style={{ marginLeft: depth * 24 }}
      >
        <span className="font-bold">{n.eartag}</span>
        <span className="text-muted-foreground">{n.breed}</span>
        <span className="text-xs bg-muted px-1.5 py-0.5 rounded">{n.sex}</span>
      </div>
      {(n.sire || n.dam) && (
        <div className="space-y-1">
          {n.sire && (
            <div>
              <p className="text-xs text-muted-foreground ml-4">Sire</p>
              <PedigreeTree node={n.sire as unknown as Record<string, unknown>} depth={depth + 1} />
            </div>
          )}
          {n.dam && (
            <div>
              <p className="text-xs text-muted-foreground ml-4">Dam</p>
              <PedigreeTree node={n.dam as unknown as Record<string, unknown>} depth={depth + 1} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
