import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { embedTexts } from "@/lib/ai/provider";
import { isEmbeddingConfigured } from "@/lib/env";
import type { Database, DocumentType } from "@/lib/types/database";

type Client = SupabaseClient<Database>;

/** Naive but effective character chunker with overlap, for bounded corpora. */
export function chunkText(text: string, size = 1500, overlap = 150): string[] {
  const clean = text.replace(/\s+\n/g, "\n").trim();
  if (clean.length <= size) return clean ? [clean] : [];
  const chunks: string[] = [];
  let start = 0;
  while (start < clean.length) {
    const end = Math.min(start + size, clean.length);
    chunks.push(clean.slice(start, end));
    if (end === clean.length) break;
    start = end - overlap;
  }
  return chunks;
}

/**
 * Create a document and its retrievable chunks (PRD §6.6). Embeddings are
 * generated only when a provider is configured; otherwise chunks are still
 * keyword-searchable via the generated tsvector column.
 */
export async function indexDocument(
  supabase: Client,
  opts: {
    firmId: string;
    clientId?: string | null;
    type: DocumentType;
    title: string;
    text: string;
    meetingId?: string | null;
    filePath?: string | null;
    mimeType?: string | null;
    uploadedBy?: string | null;
  },
): Promise<string> {
  const { data: doc, error: docErr } = await supabase
    .from("documents")
    .insert({
      firm_id: opts.firmId,
      client_id: opts.clientId ?? null,
      meeting_id: opts.meetingId ?? null,
      type: opts.type,
      title: opts.title,
      file_path: opts.filePath ?? null,
      mime_type: opts.mimeType ?? null,
      status: "processing",
      uploaded_by: opts.uploadedBy ?? null,
    })
    .select("id")
    .single();
  if (docErr) throw docErr;

  const pieces = chunkText(opts.text);
  if (pieces.length === 0) {
    await supabase.from("documents").update({ status: "indexed" }).eq("id", doc.id);
    return doc.id;
  }

  let embeddings: (number[] | null)[] = pieces.map(() => null);
  if (isEmbeddingConfigured()) {
    try {
      embeddings = await embedTexts(pieces);
    } catch {
      // Fall back to keyword-only indexing if embedding fails.
      embeddings = pieces.map(() => null);
    }
  }

  const rows = pieces.map((content, i) => ({
    document_id: doc.id,
    firm_id: opts.firmId,
    client_id: opts.clientId ?? null,
    content,
    chunk_index: i,
    token_count: Math.ceil(content.length / 4),
    embedding: embeddings[i],
  }));

  const { error: chunkErr } = await supabase.from("chunks").insert(rows);
  if (chunkErr) throw chunkErr;

  await supabase.from("documents").update({ status: "indexed" }).eq("id", doc.id);
  return doc.id;
}
