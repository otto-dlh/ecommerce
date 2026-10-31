// Pruebas del laboratorio, en el orden en que se muestran y se ejecutan.
// Cada prueba documenta su objetivo y, en orden cronologico, lo que hace el atacante y como
// responde la tienda en cada momento (steps: [actor, texto]), con el archivo donde vive el control.
// `run({ user, realtime })` lanza el ataque real y devuelve { pass, status, detail } (o { skipped }).
import { manipulatedPrice } from "./manipulatedPrice.js";
import { negativeQuantity } from "./negativeQuantity.js";
import { readOtherOrder } from "./readOtherOrder.js";
import { listUsersAsClient } from "./listUsersAsClient.js";
import { forgedWebhook } from "./forgedWebhook.js";
import { missingCsrfToken } from "./missingCsrfToken.js";
import { httpOnlyCookie } from "./httpOnlyCookie.js";
import { searchInjection } from "./searchInjection.js";
import { renderedXss } from "./renderedXss.js";
import { bruteForce } from "./bruteForce.js";
import { lastUnitRace } from "./lastUnitRace.js";
import { readDatabaseWithAnonKey } from "./readDatabaseWithAnonKey.js";
import { callDatabaseFunction } from "./callDatabaseFunction.js";
import { listenPrivateChannel } from "./listenPrivateChannel.js";
import { publishFakeEvent } from "./publishFakeEvent.js";
import { writeWithoutPermission } from "./writeWithoutPermission.js";
import { securityHeaders } from "./securityHeaders.js";

export const ATTACKS = [
  manipulatedPrice,
  negativeQuantity,
  readOtherOrder,
  listUsersAsClient,
  forgedWebhook,
  missingCsrfToken,
  httpOnlyCookie,
  searchInjection,
  renderedXss,
  bruteForce,
  lastUnitRace,
  readDatabaseWithAnonKey,
  callDatabaseFunction,
  listenPrivateChannel,
  publishFakeEvent,
  writeWithoutPermission,
  securityHeaders,
];
