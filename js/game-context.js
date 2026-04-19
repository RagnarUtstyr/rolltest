export function getGameCodeFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get("code");
  return code ? code.toUpperCase() : null;
}

export function getEntriesPath(code) {
  return `games/${code}/entries`;
}

export function getMembersPath(code) {
  return `games/${code}/members`;
}

export function getGamePath(code) {
  return `games/${code}`;
}