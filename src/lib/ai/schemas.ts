import { z } from "zod";

// Skema output JSON untuk setiap modul AI. Dipakai dua kali:
// 1) dikirim ke Claude sebagai structured output (format JSON schema),
// 2) memvalidasi ulang hasilnya di server sebelum disimpan.
// Batasan panjang (mis. "tepat 3 judul") dicek di postValidate, bukan di
// skema, karena structured output tidak mendukung semua kata kunci JSON Schema.

// ---------- Modul 1 — Channel Plan ----------
export const M1Schema = z.object({
  positioning: z.string(),
  content_pillars: z.array(
    z.object({ name: z.string(), description: z.string(), example_topics: z.array(z.string()) }),
  ),
  formats: z.array(
    z.object({
      name: z.string(),
      type: z.enum(["long", "short"]),
      duration: z.string(),
      description: z.string(),
    }),
  ),
  publish_schedule: z.object({
    long_per_week: z.number(),
    shorts_per_week: z.number(),
    best_days: z.array(z.string()),
    best_time_local: z.string(),
    notes: z.string(),
  }),
  growth_plan: z.array(z.string()),
  retention_plan: z.array(z.string()),
  monetization_opportunities: z.array(
    z.object({ name: z.string(), when: z.string(), notes: z.string() }),
  ),
  weekly_actions: z.array(
    z.object({ week: z.number(), focus: z.string(), actions: z.array(z.string()) }),
  ),
});
export type M1Output = z.infer<typeof M1Schema>;

// ---------- Modul 2 — Niche & Ideas ----------
export const M2Schema = z.object({
  niche_scores: z.array(
    z.object({
      niche: z.string(),
      demand: z.number(),
      competition: z.number(),
      monetization: z.number(),
      sustainability: z.number(),
      overall: z.number(),
      notes: z.string(),
    }),
  ),
  channel_identity: z.object({
    name_suggestions: z.array(z.string()),
    tagline: z.string(),
    tone: z.string(),
    differentiator: z.string(),
  }),
  ideal_viewer: z.object({
    description: z.string(),
    pains: z.array(z.string()),
    desires: z.array(z.string()),
  }),
  categories: z.array(z.string()),
  ideas: z.array(
    z.object({
      title: z.string(),
      angle: z.string(),
      category: z.string(),
      score: z.number(),
      reason: z.string(),
    }),
  ),
});
export type M2Output = z.infer<typeof M2Schema>;

// ---------- Modul 3 — Script, Hook & Thumbnail ----------
export const SceneSchema = z.object({
  narration: z.string(),
  visual_prompt: z.string(),
  stock_query: z.string(),
  duration_sec: z.number(),
  on_screen_text: z.string(),
  chapter_title: z.string(),
});
export const M3Schema = z.object({
  titles: z.array(z.string()),
  hooks: z.array(z.string()),
  thumbnail_concepts: z.array(
    z.object({ text: z.string(), visual: z.string(), emotion: z.string() }),
  ),
  opening: z.string(),
  scenes: z.array(SceneSchema),
  retention_tactics: z.array(z.string()),
  cta: z.string(),
  rationale: z.string(),
  description: z.string(),
  tags: z.array(z.string()),
  shorts_cut: z.object({
    hook: z.string(),
    scene_indexes: z.array(z.number()),
    title: z.string(),
  }),
});
export type M3Output = z.infer<typeof M3Schema>;
export type Scene = z.infer<typeof SceneSchema>;

// ---------- Modul 4 — Growth & Algorithm ----------
export const M4Schema = z.object({
  how_growth_works: z.array(z.object({ topic: z.string(), explanation: z.string() })),
  upload_frequency: z.object({
    long_per_week: z.number(),
    shorts_per_week: z.number(),
    reasoning: z.string(),
  }),
  test_plan: z.array(
    z.object({ hypothesis: z.string(), variable: z.string(), metric: z.string(), duration_days: z.number() }),
  ),
  optimization_rules: z.array(z.object({ when: z.string(), then: z.string() })),
  engagement_tactics: z.array(z.string()),
  subscriber_conversion: z.array(z.string()),
});
export type M4Output = z.infer<typeof M4Schema>;

// ---------- Modul 5 — Production Pipeline / QC ----------
export const M5Schema = z.object({
  workflow: z.array(z.object({ step: z.string(), tools: z.array(z.string()), tips: z.array(z.string()) })),
  templates: z.array(z.object({ name: z.string(), content: z.string() })),
  qc_checklist: z.array(z.string()),
  repurposing: z.array(z.object({ platform: z.string(), how: z.string() })),
});
export type M5Output = z.infer<typeof M5Schema>;

// ---------- Modul 6 — Monetization ----------
export const M6Schema = z.object({
  ypp_readiness: z.object({
    subs: z.number(),
    watch_hours: z.number(),
    shorts_views: z.number(),
    gap: z.string(),
    path: z.string(),
  }),
  streams: z.array(
    z.object({
      name: z.string(),
      requirements: z.string(),
      pros: z.array(z.string()),
      limits: z.array(z.string()),
      start_when: z.string(),
    }),
  ),
});
export type M6Output = z.infer<typeof M6Schema>;

// ---------- Modul 7 — Analytics Report ----------
export const M7Schema = z.object({
  period: z.string(),
  summary: z.string(),
  kpis: z.object({
    views: z.number(),
    impressions: z.number(),
    ctr: z.number(),
    avg_view_duration_sec: z.number(),
    watch_hours: z.number(),
    subs_net: z.number(),
    revenue: z.number(),
  }),
  winners: z.array(z.object({ video_id: z.string(), title: z.string(), why: z.string() })),
  underperformers: z.array(z.object({ video_id: z.string(), title: z.string(), reason: z.string() })),
  patterns: z.array(z.string()),
  recommendations: z.array(z.string()),
  next_ideas: z.array(z.object({ title: z.string(), angle: z.string(), reason: z.string() })),
});
export type M7Output = z.infer<typeof M7Schema>;

export const MODULE_SCHEMAS = {
  1: M1Schema,
  2: M2Schema,
  3: M3Schema,
  4: M4Schema,
  5: M5Schema,
  6: M6Schema,
  7: M7Schema,
} as const;
export type ModuleId = keyof typeof MODULE_SCHEMAS;
export type ModuleOutput<M extends ModuleId> = z.infer<(typeof MODULE_SCHEMAS)[M]>;

/** Pemeriksaan tambahan yang tidak bisa diekspresikan di structured output. */
export function postValidate(module: ModuleId, data: unknown): string[] {
  const errs: string[] = [];
  if (module === 3) {
    const d = data as M3Output;
    if (d.titles.length < 3) errs.push("titles harus berisi 3 judul");
    if (d.hooks.length < 3) errs.push("hooks harus berisi 3 hook");
    if (d.thumbnail_concepts.length < 3) errs.push("thumbnail_concepts harus berisi 3 konsep");
    if (d.scenes.length < 3) errs.push("scenes minimal 3");
    if (d.titles.some((t) => t.length > 100)) errs.push("setiap judul maksimal 100 karakter");
    if (d.scenes.some((s) => !s.narration.trim())) errs.push("ada scene tanpa narasi");
  }
  if (module === 2) {
    const d = data as M2Output;
    if (d.ideas.length === 0) errs.push("ideas kosong");
  }
  return errs;
}
