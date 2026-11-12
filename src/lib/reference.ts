import { randomInt } from "node:crypto";
const A = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export function newReference(prefix = "TAS") {
  const d = new Date();
  const ym = `${String(d.getUTCFullYear()).slice(2)}${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  let r = ""; for (let i = 0; i < 5; i++) r += A[randomInt(A.length)];
  return `${prefix}-${ym}-${r}`;
}
