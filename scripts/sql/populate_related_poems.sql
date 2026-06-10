TRUNCATE public.poem_relations;

INSERT INTO public.poem_relations (poem_id, related_id, score, rank)
WITH

sources AS (
  SELECT
    p.id          AS poem_id,
    p.collection_id,
    p.poet_id,
    pt.era_id,
    p.theme_id,
    p.rhyme_id,
    p.meter_id
  FROM public.poems p
  JOIN public.poets pt ON pt.id = p.poet_id
),

candidates AS (
  SELECT s.poem_id, c.related_id, c.score, c.related_slug
  FROM sources s,
  LATERAL (
    (SELECT p2.id AS related_id, 6::smallint AS score, p2.slug AS related_slug
     FROM public.poems p2
     WHERE p2.collection_id = s.collection_id AND p2.id <> s.poem_id
       AND s.collection_id IS NOT NULL
     ORDER BY p2.slug LIMIT 5)

    UNION ALL

    (SELECT p2.id, 5::smallint, p2.slug
     FROM public.poems p2
     WHERE p2.poet_id = s.poet_id AND p2.id <> s.poem_id
     ORDER BY p2.slug LIMIT 5)

    UNION ALL

    (SELECT p2.id, 4::smallint, p2.slug
     FROM public.poems p2
     JOIN public.poets pt2 ON pt2.id = p2.poet_id
     WHERE pt2.era_id = s.era_id AND p2.id <> s.poem_id
     ORDER BY p2.slug LIMIT 5)

    UNION ALL

    (SELECT p2.id, 3::smallint, p2.slug
     FROM public.poems p2
     WHERE p2.theme_id = s.theme_id AND p2.id <> s.poem_id
       AND s.theme_id IS NOT NULL
     ORDER BY p2.slug LIMIT 5)

    UNION ALL

    (SELECT p2.id, 2::smallint, p2.slug
     FROM public.poems p2
     WHERE p2.rhyme_id = s.rhyme_id AND p2.id <> s.poem_id
       AND s.rhyme_id IS NOT NULL
     ORDER BY p2.slug LIMIT 5)

    UNION ALL

    (SELECT p2.id, 1::smallint, p2.slug
     FROM public.poems p2
     WHERE p2.meter_id = s.meter_id AND p2.id <> s.poem_id
     ORDER BY p2.slug LIMIT 5)
  ) c
),

best AS (
  SELECT DISTINCT ON (poem_id, related_id)
    poem_id, related_id, score, related_slug
  FROM candidates
  ORDER BY poem_id, related_id, score DESC
),

ranked AS (
  SELECT
    poem_id,
    related_id,
    score,
    ROW_NUMBER() OVER (
      PARTITION BY poem_id
      ORDER BY score DESC, related_slug ASC
    )::smallint AS rank
  FROM best
)

SELECT poem_id, related_id, score, rank
FROM ranked
WHERE rank <= 5;
