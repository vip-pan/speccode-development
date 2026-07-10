export const TYPES = ['feature', 'bugfix', 'refactor', 'chore'];

const SLUG_RE = /^[a-z0-9-]+$/;

export function validateSlug(slug) {
  return typeof slug === 'string' && SLUG_RE.test(slug);
}

export function validateBranch(branch) {
  if (typeof branch !== 'string') return false;
  const parts = branch.split('/');
  if (parts.length !== 2) return false;
  const [type, slug] = parts;
  return TYPES.includes(type) && validateSlug(slug);
}

export function branchToStateName(branch) {
  const [type, slug] = branch.split('/');
  return `${type}__${slug}`;
}

export function stateNameToBranch(name) {
  const [type, slug] = name.split('__');
  return `${type}/${slug}`;
}
