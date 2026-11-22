// Hasilkan supabase/seed.sql dari template bawaan (src/lib/ai/templates.ts).
//   npm run seed:gen
import { writeFileSync } from "node:fs";
import { DEFAULT_TEMPLATES } from "../src/lib/ai/templates";

const q = (s: string) => `$tpl$${s}$tpl$`;
const rows = Object.entries(DEFAULT_TEMPLATES).map(
  ([m, t]) => `(null::uuid, ${m}, 1, ${q(t.name)}, ${q(t.template)}, true)`,
);
const sql = `-- Template prompt global (versi 1) untuk 7 modul AI.
-- Hanya menambah template yang belum ada, jadi aman dijalankan ulang.
insert into public.prompt_templates (user_id, module, version, name, template, is_active)
select v.* from (values
${rows.join(",\n")}
) as v(user_id, module, version, name, template, is_active)
where not exists (
  select 1 from public.prompt_templates p
  where p.user_id is null and p.module = v.module and p.version = v.version
);
`;
writeFileSync("supabase/seed.sql", sql);
console.log("supabase/seed.sql ditulis");
