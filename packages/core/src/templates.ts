/**
 * STRUCTURAL CONTENT SAFETY: which categories may carry free text at all.
 *
 * This is the first and most important of the three content-safety defences,
 * and the only one that is a rule rather than a judgement — no model, no
 * network, no key. It lives in core because the client needs it too: an app
 * that offers a "write your own dare" box and only finds out on submit that
 * dares are template-only has already asked the user to do the thing.
 *
 * The other two defences (the written policy and the classifier) call a model
 * and stay server-side in apps/api/src/lib/moderation.ts.
 */
import { CATEGORIES } from "./categories.ts";

export const TEMPLATE_ONLY_CATEGORIES = ["dares"] as const;

export function isTemplateOnly(category: string): boolean {
  return (TEMPLATE_ONLY_CATEGORIES as readonly string[]).includes(category);
}

export type TemplateRefusal =
  | "needs-a-template"
  | "template-category-mismatch"
  | null;

/**
 * Pure. Whether this (category, template) pair is allowed to exist.
 *
 * `templateCategory` is what the ChallengeTemplate row actually says, and it is
 * checked because otherwise the rule is trivially bypassed: point a `dares` bet
 * at some `grades` template id, and the free-text title rides along attached to
 * a template that has nothing to do with it. Pass `undefined` when the template
 * has not been loaded yet — the schema boundary can only see the id, so it
 * enforces presence, and `createBet` enforces the match once it has the row.
 */
export function templateRefusal(args: {
  category: string;
  templateId?: string | null;
  templateCategory?: string | null;
}): TemplateRefusal {
  if (!isTemplateOnly(args.category)) return null;
  if (!args.templateId) return "needs-a-template";
  if (args.templateCategory === undefined) return null; // not loaded; checked later
  if (args.templateCategory !== args.category) return "template-category-mismatch";
  return null;
}

export function templateRefusalMessage(r: Exclude<TemplateRefusal, null>): string {
  return r === "needs-a-template"
    ? "Dares have to be picked from the challenge list — you can't write your own."
    : "That challenge isn't a dare.";
}

/** Sanity: every template-only category is a real category. */
for (const c of TEMPLATE_ONLY_CATEGORIES) {
  if (!(CATEGORIES as readonly string[]).includes(c))
    throw new Error(`TEMPLATE_ONLY_CATEGORIES names "${c}", which is not a category`);
}
