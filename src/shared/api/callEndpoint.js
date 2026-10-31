// Une el catalogo de endpoints con el transporte HTTP: el metodo y la ruta salen del catalogo, nunca del llamador.
import { api, request } from "./httpClient.js";

/**
 * Llama un endpoint y devuelve sus datos; lanza un Error con el mensaje de la API si la respuesta no es 2xx.
 * @param {{ method: string, url: Function }} endpoint
 * @param {{ params?: object, query?: object, body?: any, csrf?: boolean, headers?: object }} [options]
 */
export function callEndpoint(endpoint, { params, query, ...options } = {}) {
  return api(endpoint.url(params, query), { method: endpoint.method, ...options });
}

/** Igual que callEndpoint, pero devuelve la respuesta cruda { ok, status, data } sin lanzar errores. */
export function requestEndpoint(endpoint, { params, query, ...options } = {}) {
  return request(endpoint.url(params, query), { method: endpoint.method, ...options });
}
