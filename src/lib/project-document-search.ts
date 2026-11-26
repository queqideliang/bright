function terms(value: string) {
  const words = value.toLowerCase().match(/[a-z0-9_]+|[\p{Script=Han}]+/gu) || [];
  return new Set(words.flatMap(word => {
    if (word.length < 2 || !/\p{Script=Han}/u.test(word)) return [word];
    return Array.from({length: word.length - 1}, (_, i) => word.slice(i, i + 2));
  }));
}

export function findPassages(docs: { title: string; passages: { location: string; text: string }[] }[], question: string) {
  const query = terms(question);
  const rows = docs.flatMap(doc => doc.passages.map(p => ({title: doc.title, ...p})));
  const frequency = new Map<string, number>();
  const ranked = rows.map(row => {
    const content = (row.title + ' ' + row.location + ' ' + row.text).toLowerCase();
    const hits = [...query].filter(term => content.includes(term));
    for (const term of hits) frequency.set(term, (frequency.get(term) ?? 0) + 1);
    return {row, hits};
  }).map(({row, hits}) => ({ row, score: hits.reduce((n, term) => n + 1 + Math.log((rows.length + 1) / (frequency.get(term)! + 1)), 0) }));
  const ordered = ranked.sort((a,b) => b.score - a.score);
  return ordered.filter(item => rows.length <= 6 || item.score > 0).slice(0,6).map(({row},i) => ({id:'S' + (i + 1), ...row}));
}

