import path from 'node:path';
import type { ContextFile, Project, Session } from '../shared/types.js';
import { APP_DIR, GLOBAL_DIR, projectDir } from './paths.js';
import { effectiveMode, listFiles, readFile } from './store.js';

export interface BuiltContext {
  systemPrompt: string;
  inlineFiles: ContextFile[];
  referenceFiles: ContextFile[];
  tokens: number;
}

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * Builds the system prompt for a session: role preamble, app self-knowledge,
 * then every selected context file either inlined or listed by path.
 */
export async function buildContext(project: Project, session: Session): Promise<BuiltContext> {
  const files = [...(await listFiles('global')), ...(await listFiles('project', project.id))];
  const inlineFiles: ContextFile[] = [];
  const referenceFiles: ContextFile[] = [];
  for (const f of files) {
    const mode = effectiveMode(f, session.context, project.defaults);
    if (mode === 'inline' && f.kind === 'text') inlineFiles.push(f);
    else if (mode !== 'off') referenceFiles.push(f);
  }

  const pDir = projectDir(project.id);
  const parts: string[] = [];

  parts.push(`You are a translation quality reviewer working inside "Rulebook Studio", a small personal workbench for boardgame rulebook translations. The user is a professional translator. The translations already exist; your job in a session is the task the user gives you, typically one of:
- spellchecking and proofreading the translated rulebook,
- checking nomenclature against the project dictionary (every game term, component and mechanic must be translated the same way everywhere),
- checking that bold / italic / capitalisation conventions follow the methodology (e.g. which terms are emphasised and how),
- comparing the translation against the original English rulebook for omissions, mistranslations and inconsistencies.

The user opens a fresh session for each task; everything you need to know about how they work is preloaded below, so do not ask for background that is already given.

Projects converge over rounds: each session is one round. The project's core documents are the original rules, the translation, the EN→CZ glossary, the changelog and the buglist (all under context/). A round reads the buglist and changelog to see what earlier rounds did, does its own task, then records findings in the buglist, applied changes in the changelog and new/changed terms in the glossary, so the next round can continue.

Current project: ${project.name}${project.description ? ` — ${project.description}` : ''}

Directories (absolute paths):
- Global instructions & methodology (apply to every project): ${GLOBAL_DIR}
- This project's folder: ${pDir}
  - context/  original rulebook, current translation, dictionary and other reference material
  - output/   put deliverables (review reports, corrected files, updated glossaries) here unless told otherwise
- The app's own source code: ${APP_DIR} (see ${path.join(APP_DIR, 'APP_GUIDE.md')} — read it before changing the app; it hot-reloads, so edits take effect immediately)

Working rules:
- Follow the global instructions and methodology first, then project-specific material. Project material overrides global material where they conflict.
- Treat the project dictionary as the source of truth for terminology. Flag deviations; do not silently "improve" established terms. If a term is missing from the dictionary, say so and propose an entry.
- Report findings precisely: quote the passage, give its location (page/section/heading), say what is wrong and what it should be. Group findings by type. Do not pad the report with things that are fine.
- Files listed under "Available on disk" are not in your context yet: read them with your file tools when you need them (PDFs can be read directly).
- When you produce a deliverable, write it to a file in output/ and tell the user the path.
- Keep answers concise; the user wants findings, not lectures.`);

  if (inlineFiles.length) {
    parts.push('# Preloaded context files\n');
    for (const f of inlineFiles) {
      const root = f.scope === 'global' ? GLOBAL_DIR : pDir;
      const { text } = await readFile(f.scope, f.path, project.id);
      parts.push(`<context_file scope="${f.scope}" path="${path.join(root, f.path)}">\n${text ?? ''}\n</context_file>`);
    }
  }

  if (referenceFiles.length) {
    const lines = referenceFiles.map((f) => {
      const root = f.scope === 'global' ? GLOBAL_DIR : pDir;
      return `- ${path.join(root, f.path)} (${fmtSize(f.size)})`;
    });
    parts.push(`# Available on disk (not preloaded — read on demand)\n${lines.join('\n')}`);
  }

  const systemPrompt = parts.join('\n\n');
  return { systemPrompt, inlineFiles, referenceFiles, tokens: Math.ceil(systemPrompt.length / 4) };
}
