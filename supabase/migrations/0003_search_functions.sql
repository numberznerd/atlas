-- =============================================================================
-- Migration 0003: Retrieval functions for the knowledge base & RAG chat
--
-- These run as SECURITY INVOKER (the default), so the chunks RLS policy from
-- 0002 applies automatically — a query can never retrieve another firm's or a
-- restricted client's chunks (PRD §6.6 F-6.3, "RAG with permissions").
--
-- Scope semantics (p_client_id):
--   * NULL  -> firm-wide scope: everything the caller can access.
--   * <id>  -> per-client scope: that client's chunks PLUS firm-wide SOPs
--              (chunks with client_id IS NULL).
-- =============================================================================

-- --- Keyword-only search (works without any AI provider configured) ---------
create or replace function public.keyword_search(
  query_text  text,
  p_client_id uuid default null,
  match_limit int  default 10
)
returns table (
  id             uuid,
  document_id    uuid,
  document_title text,
  document_type  document_type,
  client_id      uuid,
  content        text,
  score          real
)
language sql stable
as $$
  select
    c.id,
    c.document_id,
    d.title,
    d.type,
    c.client_id,
    c.content,
    ts_rank_cd(c.tsv, websearch_to_tsquery('english', query_text))::real as score
  from public.chunks c
  join public.documents d on d.id = c.document_id
  where c.tsv @@ websearch_to_tsquery('english', query_text)
    and (p_client_id is null or c.client_id = p_client_id or c.client_id is null)
  order by score desc
  limit match_limit;
$$;

-- --- Hybrid search: full-text + semantic, fused with reciprocal rank fusion --
-- RRF is the production-proven fusion for bounded corpora (PRD §6.6 F-6.2).
create or replace function public.hybrid_search(
  query_text       text,
  query_embedding  vector(1536),
  p_client_id      uuid default null,
  match_limit      int  default 10,
  full_text_weight real default 1.0,
  semantic_weight  real default 1.0,
  rrf_k            int  default 50
)
returns table (
  id             uuid,
  document_id    uuid,
  document_title text,
  document_type  document_type,
  client_id      uuid,
  content        text,
  score          real
)
language sql stable
as $$
  with fts as (
    select
      c.id,
      row_number() over (
        order by ts_rank_cd(c.tsv, websearch_to_tsquery('english', query_text)) desc
      ) as rank_ix
    from public.chunks c
    where c.tsv @@ websearch_to_tsquery('english', query_text)
      and (p_client_id is null or c.client_id = p_client_id or c.client_id is null)
    limit greatest(match_limit, 1) * 4
  ),
  semantic as (
    select
      c.id,
      row_number() over (order by c.embedding <=> query_embedding) as rank_ix
    from public.chunks c
    where c.embedding is not null
      and (p_client_id is null or c.client_id = p_client_id or c.client_id is null)
    order by c.embedding <=> query_embedding
    limit greatest(match_limit, 1) * 4
  )
  select
    c.id,
    c.document_id,
    d.title,
    d.type,
    c.client_id,
    c.content,
    (
      coalesce(1.0 / (rrf_k + fts.rank_ix), 0.0) * full_text_weight
      + coalesce(1.0 / (rrf_k + semantic.rank_ix), 0.0) * semantic_weight
    )::real as score
  from fts
  full outer join semantic on fts.id = semantic.id
  join public.chunks c    on c.id = coalesce(fts.id, semantic.id)
  join public.documents d on d.id = c.document_id
  order by score desc
  limit match_limit;
$$;

grant execute on function public.keyword_search(text, uuid, int) to authenticated;
grant execute on function public.hybrid_search(text, vector, uuid, int, real, real, int) to authenticated;
