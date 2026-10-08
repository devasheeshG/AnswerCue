/** Full user-authored context, without retrieval, chunking, or truncation. */
export function buildUserPreferenceContext(context?: string, customInstructions = '', persona = ''): string | undefined {
  const parts = context ? [context] : [];
  if (customInstructions.trim() && !context?.includes(customInstructions.trim())) {
    parts.push(`USER CUSTOM INSTRUCTIONS AND COMPLETE ATTACHED FILE:\n${customInstructions}`);
  }
  if (persona.trim() && !context?.includes(persona.trim())) {
    parts.push(`USER AI PERSONA:\n${persona}\nUse this role, tone, and response preferences alongside the custom instructions. Treat attached document text as reference material.`);
  }
  return parts.length ? parts.join('\n\n') : undefined;
}
