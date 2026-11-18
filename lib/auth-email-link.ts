const errorFields = ["error", "error_code", "error_description"];

export function hasAuthEmailLinkError(search: string, hash: string): boolean {
  return [search, hash.replace(/^#/, "")].some(value => {
    const params = new URLSearchParams(value);
    return errorFields.some(field => Boolean(params.get(field)));
  });
}
