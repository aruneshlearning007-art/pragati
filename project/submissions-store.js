const KEY = 'pragati_submissions';

export function loadSubmissions() {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (e) { return []; }
}
export function saveSubmissions(list) {
  localStorage.setItem(KEY, JSON.stringify(list));
  window.dispatchEvent(new Event('pragati-submissions-changed'));
}
export function addSubmission(sub) {
  const list = loadSubmissions();
  list.push(sub);
  saveSubmissions(list);
  return sub;
}
export function updateSubmission(id, patch) {
  const list = loadSubmissions();
  const next = list.map(s => s.id === id ? { ...s, ...patch } : s);
  saveSubmissions(next);
  return next.find(s => s.id === id);
}
