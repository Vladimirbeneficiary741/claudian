import type { VaultFileAdapter } from '../../core/storage/VaultFileAdapter';

export const BUILTIN_SCRAPING_SKILL_NAME = 'scraping';
export const BUILTIN_CLAUDE_SCRAPING_SKILL_PATH = `.claude/skills/${BUILTIN_SCRAPING_SKILL_NAME}/SKILL.md`;
export const BUILTIN_CODEX_SCRAPING_SKILL_PATH = `.codex/skills/${BUILTIN_SCRAPING_SKILL_NAME}/SKILL.md`;

const BUILTIN_SCRAPING_SKILL_MARKDOWN = `---
description: Gather and structure data from webpages based on user-defined extraction requirements
user-invocable: true
---
You are the dedicated web scraping and structured extraction skill.

When invoked, help the user collect data from webpages or website flows based on explicit requirements.

Operating rules:
- First identify the target source, extraction fields, pagination scope, and desired output format.
- If the request is underspecified, ask for the smallest missing detail needed to scrape correctly.
- Prefer reliable, repeatable extraction over one-off copying.
- Use the tools available in the active runtime to inspect pages, navigate, extract content, and save results.
- If browser automation is available, use it for dynamic pages or login-gated flows the user explicitly authorizes.
- If shell or scripting tools are available, use them to normalize, deduplicate, and structure the extracted data.
- Keep track of source URLs for every extracted record whenever possible.
- Respect robots, rate limits, login boundaries, and obvious anti-abuse constraints.
- Do not invent missing data. Mark uncertain fields as missing or unknown.

Default workflow:
1. Restate the scraping goal in one short sentence.
2. Determine the extraction schema:
   - source
   - fields
   - filters
   - pagination depth
   - output format
3. Inspect one sample page before scaling up.
4. Extract data in batches and validate a few records before continuing.
5. Return:
   - summary of what was collected
   - extraction coverage and any limits encountered
   - structured output or saved file location
   - next-step recommendation if the source needs a second pass

Output expectations:
- For small jobs, return a clean markdown table or bullet list.
- For larger jobs, save as JSON, CSV, or Markdown in the workspace and tell the user where it was written.
- Always include enough provenance for the user to audit the result.
`;

async function ensureBuiltinSkill(
  adapter: Pick<VaultFileAdapter, 'exists' | 'write'>,
  skillPath: string,
  skillMarkdown: string,
): Promise<void> {
  if (await adapter.exists(skillPath)) {
    return;
  }

  await adapter.write(skillPath, skillMarkdown);
}

export async function ensureBuiltinClaudeSkills(
  adapter: Pick<VaultFileAdapter, 'exists' | 'write'>,
): Promise<void> {
  await ensureBuiltinSkill(
    adapter,
    BUILTIN_CLAUDE_SCRAPING_SKILL_PATH,
    BUILTIN_SCRAPING_SKILL_MARKDOWN,
  );
}

export async function ensureBuiltinCodexSkills(
  adapter: Pick<VaultFileAdapter, 'exists' | 'write'>,
): Promise<void> {
  await ensureBuiltinSkill(
    adapter,
    BUILTIN_CODEX_SCRAPING_SKILL_PATH,
    BUILTIN_SCRAPING_SKILL_MARKDOWN,
  );
}
