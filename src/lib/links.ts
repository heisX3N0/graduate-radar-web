// Apply links must be https, http or mailto (spec section 5.1). Kept free of imports so
// browser code can use it without pulling in the Zod schema.
export function isAllowedLink(link: string): boolean {
  return /^(https?:\/\/|mailto:)\S/i.test(link.trim());
}
