// Administracion de categorias. No se borran: se desactivan, para no dejar productos huerfanos.
import { ConflictError, NotFoundError } from "../../../shared/domain/errors.mjs";
import * as v from "../../../shared/domain/validate.mjs";
import { parseCategoryInput } from "../domain/catalog.mjs";

const byOrder = (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "es");

export function createCategoryAdminService({ categories, products, audit, events }) {
  async function listAll() {
    const [all, catalog] = await Promise.all([categories.list(), products.list()]);
    const counts = new Map();
    for (const p of catalog) counts.set(p.categoryId, (counts.get(p.categoryId) ?? 0) + 1);
    return all.sort(byOrder).map((c) => ({ ...c, products: counts.get(c.id) ?? 0 }));
  }

  async function create(ctx, body) {
    let category;
    try {
      category = await categories.create(parseCategoryInput(body));
    } catch (err) {
      if (err instanceof ConflictError) throw new ConflictError("Ya existe una categoría con ese id");
      throw err;
    }
    await audit.record(ctx, "category.create", { target: `category:${category.id}` });
    await events.emit("category.changed", { categoryId: category.id });
    return category;
  }

  async function update(ctx, rawId, body) {
    const id = v.slug(rawId);
    const changes = parseCategoryInput(body, { partial: true });
    const category = await categories.update(id, changes);
    if (!category) throw new NotFoundError("Categoría no encontrada");
    await audit.record(ctx, "category.update", { target: `category:${id}`, details: changes });
    await events.emit("category.changed", { categoryId: id });
    return category;
  }

  return { listAll, create, update };
}
