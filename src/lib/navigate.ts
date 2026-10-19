/**
 * A full page load, used wherever the session changes (sign-out, a refused
 * API call). It drops every client-side cache, so
 * the server decides what the person sees next and Back cannot re-show a
 * page rendered for the previous session state.
 */
export function navigate(path: string) {
  window.location.assign(path);
}
