const apiBase = typeof window !== 'undefined' ? `${location.origin}/api` : '/api'
// komut çalıştırma isteği gönderir
export async function runCommand(agentId, cmd) {
  const r = await fetch(`${apiBase}/command`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ agentId, cmd })
  })
  if (r.status !== 202) throw new Error(`command failed: ${r.status}`)
}
// belirli bir ajan için son komut çıktısını alır
export async function getOutput(agentId) {
  const r = await fetch(`${apiBase}/output/${encodeURIComponent(agentId)}`)
  if (r.status === 204) return ''
  if (!r.ok) throw new Error('getOutput failed')
  return r.text()
}
// sistem metriklerini alır
export async function getMetrics() {
  const r = await fetch(`${apiBase}/metrics`)
  if (!r.ok) throw new Error('getMetrics failed')
  return r.json()
}
