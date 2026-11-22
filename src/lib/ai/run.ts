import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { adminClient } from "../supabase/admin";
import { requireSecret } from "../secrets";
import { env } from "../env";
import { MODULE_SCHEMAS, postValidate, type ModuleId, type ModuleOutput } from "./schemas";
import { DEFAULT_TEMPLATES, SYSTEM_PROMPT, renderTemplate } from "./templates";

const MAX_SCHEMA_RETRIES = 2; // sesuai acceptance criteria: retry otomatis maksimal 2x

export class AIModuleError extends Error {
  constructor(message: string, public readonly attempts: number, public readonly lastRaw?: string) {
    super(message);
  }
}

/** Template aktif: versi milik user terbaru → versi global → bawaan kode. */
export async function loadTemplate(userId: string, module: ModuleId) {
  const { data } = await adminClient()
    .from("prompt_templates")
    .select("template,version,user_id")
    .eq("module", module)
    .eq("is_active", true)
    .or(`user_id.eq.${userId},user_id.is.null`)
    .order("version", { ascending: false });
  const own = data?.find((t) => t.user_id === userId);
  const global = data?.find((t) => t.user_id === null);
  const pick = own ?? global;
  if (pick) return { template: pick.template as string, version: pick.version as number };
  return { template: DEFAULT_TEMPLATES[module].template, version: 0 };
}

export interface RunModuleOptions {
  userId: string;
  module: ModuleId;
  vars: Record<string, unknown>;
  effort?: "low" | "medium" | "high" | "xhigh";
  onLog?: (msg: string) => void;
}

/**
 * Jalankan satu modul AI dan kembalikan output JSON yang sudah divalidasi Zod.
 * Output tidak valid → diulang dengan umpan balik kesalahan, maksimal 2x.
 */
export async function runModule<M extends ModuleId>(opts: RunModuleOptions & { module: M }) {
  const { userId, module, vars, onLog } = opts;
  const schema = MODULE_SCHEMAS[module];
  const apiKey = await requireSecret(userId, "ANTHROPIC_API_KEY");
  const client = new Anthropic({ apiKey });
  const model = env.anthropicModel();
  const { template, version } = await loadTemplate(userId, module);
  const language = (vars.language as string) || "id";
  const userPrompt = renderTemplate(template, { ...vars, language });
  const system = renderTemplate(SYSTEM_PROMPT, { language });

  let feedback = "";
  let lastRaw = "";
  for (let attempt = 0; attempt <= MAX_SCHEMA_RETRIES; attempt++) {
    onLog?.(`M${module}: percobaan ${attempt + 1}`);
    const content = feedback
      ? `${userPrompt}\n\nPERCOBAAN SEBELUMNYA DITOLAK karena: ${feedback}\nPerbaiki dan keluarkan JSON lengkap yang valid.`
      : userPrompt;

    // Streaming: output modul (mis. 100 ide / skrip lengkap) bisa panjang.
    const stream = client.beta.messages.stream({
      model,
      max_tokens: 64000,
      system,
      messages: [{ role: "user", content }],
      output_config: { effort: opts.effort ?? "high", format: betaZodOutputFormat(schema) },
      // Jika request ditolak classifier keamanan, server mencoba ulang dengan model cadangan.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
    });
    const msg = await stream.finalMessage();

    if (msg.stop_reason === "refusal") {
      throw new AIModuleError(
        `Claude menolak permintaan M${module}${msg.stop_details?.category ? ` (${msg.stop_details.category})` : ""}.`,
        attempt + 1,
      );
    }
    if (msg.stop_reason === "max_tokens") {
      feedback = "output terpotong karena terlalu panjang; ringkas isinya";
      continue;
    }

    lastRaw = msg.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");

    let parsed: unknown;
    try {
      parsed = JSON.parse(lastRaw);
    } catch {
      feedback = "output bukan JSON yang valid";
      continue;
    }
    const result = schema.safeParse(parsed);
    if (!result.success) {
      feedback = result.error.issues
        .slice(0, 8)
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ");
      continue;
    }
    const extra = postValidate(module, result.data);
    if (extra.length) {
      feedback = extra.join("; ");
      continue;
    }
    onLog?.(`M${module}: valid (model ${msg.model}, ${msg.usage.output_tokens} token output)`);
    return {
      data: result.data as ModuleOutput<M>,
      model: msg.model,
      templateVersion: version,
      usage: msg.usage,
    };
  }
  throw new AIModuleError(
    `Output M${module} tetap tidak valid setelah ${MAX_SCHEMA_RETRIES + 1} percobaan: ${feedback}`,
    MAX_SCHEMA_RETRIES + 1,
    lastRaw,
  );
}
