export async function sessionToken(password) {
  const data = new TextEncoder().encode(`${password}:heme-arm`);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
