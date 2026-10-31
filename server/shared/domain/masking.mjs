// Enmascarado de datos personales para bitacoras y paneles (ASVS v5.0.0-16.2.5, T12).

export function maskEmail(email) {
  if (!email) return null;
  const [user, domain] = String(email).split("@");
  return `${user.slice(0, 1)}***@${domain ?? ""}`;
}

const IPV4_MAPPED = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i;
const LOOPBACK_V6 = "::1";

/** IPv4: ultimo octeto en 0. IPv6: solo el prefijo /48 (tres primeros grupos). */
export function maskIp(ip) {
  if (!ip) return null;
  const mapped = IPV4_MAPPED.exec(ip);
  const address = mapped ? mapped[1] : ip;
  if (address.includes(".")) return address.split(".").slice(0, 3).concat("0").join(".");
  if (address === LOOPBACK_V6) return LOOPBACK_V6;
  const [head] = address.split("::");
  const groups = head.split(":").filter(Boolean).slice(0, 3);
  return `${groups.join(":")}::`;
}

/** Agente de usuario resumido: navegador y sistema, sin version completa. */
export function summarizeUserAgent(ua) {
  if (!ua) return "Desconocido";
  const browser = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Otro";
  const os = /Windows/.test(ua) ? "Windows" : /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iOS" : /Mac OS X/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : "Otro";
  return `${browser} · ${os}`;
}
