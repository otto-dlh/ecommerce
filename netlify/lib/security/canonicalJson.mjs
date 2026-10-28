// Serializacion canonica: mismas claves en el mismo orden sin importar como se guardo el objeto.
// Necesaria para verificar firmas despues de pasar por una base de datos que reordena JSON (p. ej. jsonb).

export function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    const keys = Object.keys(value).filter((key) => value[key] !== undefined).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}
