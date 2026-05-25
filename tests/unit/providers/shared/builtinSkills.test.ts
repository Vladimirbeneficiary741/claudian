import {
  BUILTIN_CLAUDE_SCRAPING_SKILL_PATH,
  BUILTIN_CODEX_SCRAPING_SKILL_PATH,
  BUILTIN_SCRAPING_SKILL_NAME,
  ensureBuiltinClaudeSkills,
  ensureBuiltinCodexSkills,
} from '@/providers/shared/builtinSkills';

function createMockAdapter(existingPaths: string[] = []) {
  const existing = new Set(existingPaths);

  return {
    exists: jest.fn(async (path: string) => existing.has(path)),
    write: jest.fn(async (path: string) => {
      existing.add(path);
    }),
  };
}

describe('builtin scraping skills', () => {
  it('installs the Claude scraping skill when missing', async () => {
    const adapter = createMockAdapter();

    await ensureBuiltinClaudeSkills(adapter);

    expect(adapter.write).toHaveBeenCalledWith(
      BUILTIN_CLAUDE_SCRAPING_SKILL_PATH,
      expect.stringContaining(`description: Gather and structure data from webpages`),
    );
    expect(adapter.write).toHaveBeenCalledWith(
      BUILTIN_CLAUDE_SCRAPING_SKILL_PATH,
      expect.stringContaining(BUILTIN_SCRAPING_SKILL_NAME),
    );
  });

  it('does not overwrite the Claude scraping skill when it already exists', async () => {
    const adapter = createMockAdapter([BUILTIN_CLAUDE_SCRAPING_SKILL_PATH]);

    await ensureBuiltinClaudeSkills(adapter);

    expect(adapter.write).not.toHaveBeenCalled();
  });

  it('installs the Codex scraping skill when missing', async () => {
    const adapter = createMockAdapter();

    await ensureBuiltinCodexSkills(adapter);

    expect(adapter.write).toHaveBeenCalledWith(
      BUILTIN_CODEX_SCRAPING_SKILL_PATH,
      expect.stringContaining('Default workflow:'),
    );
    expect(adapter.write).toHaveBeenCalledWith(
      BUILTIN_CODEX_SCRAPING_SKILL_PATH,
      expect.stringContaining('structured output'),
    );
  });

  it('does not overwrite the Codex scraping skill when it already exists', async () => {
    const adapter = createMockAdapter([BUILTIN_CODEX_SCRAPING_SKILL_PATH]);

    await ensureBuiltinCodexSkills(adapter);

    expect(adapter.write).not.toHaveBeenCalled();
  });
});
