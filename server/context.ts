import path from 'node:path';
import fs from 'node:fs/promises';
import { GLOBAL_OWNER, INLINE_LIMIT_BYTES, type ContextFile, type Session } from '../shared/types.js';
import { APP_DIR, GLOBAL_DIR, projectDir } from './paths.js';
import { getProject, listFiles, readFile } from './store.js';

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const USER_PROFILE = `The person you are talking to is a professional boardgame translator. They are not a programmer and do not know how AI tools work. Write to them in plain, friendly language: no jargon, no file paths unless they need to click something, no code. Short answers. When something is ambiguous, ask one short question instead of guessing.`;

const NO_SHELL = `Use your file tools (read, edit, write, search) to look at and change files. Avoid shell commands unless there is no other way — every one of them interrupts the user with a permission question.`;

async function inlineBlock(f: ContextFile, projectId?: string): Promise<string> {
  const root = f.scope === 'global' ? GLOBAL_DIR : projectDir(projectId!);
  const { text } = await readFile(f.scope, f.path, projectId);
  return `<file path="${path.join(root, f.path)}">\n${text ?? ''}\n</file>`;
}

function canInline(f: ContextFile): boolean {
  return f.kind === 'text' && f.size <= INLINE_LIMIT_BYTES;
}

/** Builds the text that is handed to the assistant when a session starts. */
export async function buildContext(session: Session): Promise<string> {
  switch (session.kind) {
    case 'work': return buildWorkContext(session);
    case 'instructions': return buildInstructionsContext(session);
    case 'app': return buildAppContext();
  }
}

// ---------- work: a review round inside a game ----------

async function buildWorkContext(session: Session): Promise<string> {
  const project = await getProject(session.owner);
  const globalFiles = await listFiles('global');
  const projectFiles = await listFiles('project', project.id);
  const instructionFiles = projectFiles.filter((f) => f.path.startsWith('instructions/'));
  const otherFiles = projectFiles.filter((f) => !f.path.startsWith('instructions/'));
  const pDir = projectDir(project.id);

  const parts: string[] = [];
  parts.push(`You are a translation quality reviewer working inside "Rulebook Studio", a small personal workbench for boardgame rulebook translations. The translations already exist; your job in a session is whatever the user asks, typically one of:
- spellchecking and proofreading the translated rulebook,
- checking nomenclature against the project glossary (every game term, component and mechanic must be translated the same way everywhere),
- checking that bold / italic / capitalisation conventions follow the methodology and match the original,
- comparing the translation against the original English rulebook for omissions, mistranslations and inconsistencies.

${USER_PROFILE}

Projects converge over rounds: each session is one round. The project's core documents are the original rules, the translation, the EN→CZ glossary, the changelog and the buglist (all under context/). A round reads the buglist and changelog to see what earlier rounds did, does its own task, then records findings in the buglist, applied changes in the changelog and new/changed terms in the glossary, so the next round can continue.

Current game: ${project.name}${project.description ? ` — ${project.description}` : ''}

Folders (absolute paths):
- Persistent instructions for every game: ${GLOBAL_DIR}
- This game: ${pDir}
  - instructions/  persistent instructions for this game only (they win over the general ones)
  - context/       original rulebook, current translation, glossary, changelog, buglist, other reference material
  - output/        put deliverables (review reports, corrected files) here unless told otherwise
- The app itself: ${APP_DIR} (if the user asks to change the app, read ${path.join(APP_DIR, 'APP_GUIDE.md')} first; it hot-reloads)

Working rules:
- Follow the persistent instructions first (game-specific ones win over general ones), then everything else.
- Treat the glossary as the source of truth for terminology. Flag deviations; do not silently "improve" established terms. If a term is missing from the glossary, say so and propose an entry.
- Report findings precisely: quote the passage, give its location (page/section/heading), say what is wrong and what it should be. Group findings by type. Do not pad the report with things that are fine.
- Files listed under "Files for this game" are not loaded yet: open them when you need them (PDFs can be read directly). Word and Excel uploads have a converted .md/.csv next to them — use the converted one.
- When you produce a deliverable, write it to a file in output/ and tell the user its name.
- ${NO_SHELL}`);

  parts.push('# Persistent instructions (every game)\n');
  for (const f of globalFiles) if (canInline(f)) parts.push(await inlineBlock(f));
  if (instructionFiles.length) {
    parts.push(`# Persistent instructions for ${project.name}\n`);
    for (const f of instructionFiles) if (canInline(f)) parts.push(await inlineBlock(f, project.id));
  }
  const listed = [...globalFiles.filter((f) => !canInline(f)), ...otherFiles];
  if (listed.length) {
    parts.push(`# Files for this game (open on demand)\n${listed.map((f) => `- ${path.join(f.scope === 'global' ? GLOBAL_DIR : pDir, f.path)} (${fmtSize(f.size)})`).join('\n')}`);
  }
  return parts.join('\n\n');
}

// ---------- instructions: the AI edits persistent instructions on request ----------

async function buildInstructionsContext(session: Session): Promise<string> {
  const isGlobal = session.owner === GLOBAL_OWNER;
  const project = isGlobal ? undefined : await getProject(session.owner);
  const targetDir = isGlobal ? GLOBAL_DIR : path.join(projectDir(session.owner), 'instructions');
  const globalFiles = await listFiles('global');
  const target = isGlobal
    ? globalFiles
    : (await listFiles('project', project!.id)).filter((f) => f.path.startsWith('instructions/'));

  const parts: string[] = [];
  parts.push(`You maintain the persistent instructions of "Rulebook Studio", a workbench for reviewing boardgame rulebook translations. Persistent instructions are Markdown files that every future AI session reads before starting work. ${isGlobal
    ? 'The ones you maintain in this session apply to EVERY game.'
    : `The ones you maintain in this session apply ONLY to the game "${project!.name}" and win over the general instructions where they conflict.`}

${USER_PROFILE}

Your job: the user tells you, in their own words, what the instructions should say or how they should change. You turn that into clear, well-organised Markdown in ${targetDir} — editing existing files or creating new ones with descriptive names (for example "terminology-rules.md"). Keep related rules together, remove contradictions, and keep the wording precise so a future session can follow it literally. Do not touch files outside that folder. ${NO_SHELL}

When you are done, reply with 2–5 plain sentences: what the instructions now say that they did not before (or what was removed). Do not paste file contents or Markdown syntax into your reply. If the request is unclear or would contradict an existing rule, ask one short question before editing.`);

  parts.push(`# Current ${isGlobal ? 'general' : 'game-specific'} instruction files (${targetDir})\n`);
  if (target.length) { for (const f of target) if (canInline(f)) parts.push(await inlineBlock(f, project?.id)); }
  else parts.push('(none yet — create the first file)');
  if (!isGlobal) {
    parts.push(`# General instructions that apply to every game (read-only here; ${GLOBAL_DIR})\n`);
    for (const f of globalFiles) if (canInline(f)) parts.push(await inlineBlock(f));
  }
  return parts.join('\n\n');
}

// ---------- app: the AI modifies this app ----------

async function buildAppContext(): Promise<string> {
  const guide = await fs.readFile(path.join(APP_DIR, 'APP_GUIDE.md'), 'utf8').catch(() => '(APP_GUIDE.md missing)');
  return `You are the built-in developer of "Rulebook Studio", a small web app the user runs on their own computer. In this session the user asks for changes to the app itself and you make them directly in its source code at ${APP_DIR}. The app hot-reloads: the API server restarts automatically when server code changes and the browser picks up UI changes within seconds. Assistant sessions (like this one) keep running through those restarts.

${USER_PROFILE} They will describe what they want in everyday terms ("make the text bigger", "add a button that…"). Translate that into the right code change yourself; never ask them technical questions when a sensible default exists.

Rules:
- Read the guide below before editing. Keep the existing structure and style; make the smallest change that fully does what was asked.
- ${NO_SHELL} The one command you normally need is "npm run typecheck", run on its own; run it before you finish and fix anything it reports. Do not leave the app broken.
- Do not modify anything under ${path.join(APP_DIR, 'workspace')} (that is the user's data), and do not change how data is stored on disk unless the user explicitly asks.
- Do not add dependencies unless truly necessary.
- When done, reply with 2–4 plain sentences describing what changed from the user's point of view and where to find it. No code, no file names, no technical terms. If a change needs the app to be restarted (for example a change to the terminal host or the start scripts), say so clearly.

# APP_GUIDE.md

${guide}`;
}
