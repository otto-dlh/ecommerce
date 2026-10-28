// La suite de contrato contra el proveedor en memoria (siempre se ejecuta).
import { describeRepositoryContract } from "./repositoryContract.mjs";
import { createMemoryAdapters } from "../../netlify/lib/infra/memory/index.mjs";

describeRepositoryContract("memory", async () => createMemoryAdapters());
