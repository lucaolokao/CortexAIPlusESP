'use strict';

/**
 * Cache in-memory com TTL (Time-To-Live).
 * Usado para endpoints que retornam dados relativamente estáticos
 * e são frequentemente acessados (categorias, stats, top-produtos).
 */

const cache = new Map();

class CacheEntry {
  constructor(data, ttlMs) {
    this.data = data;
    this.expireAt = Date.now() + ttlMs;
  }

  get isExpired() {
    return Date.now() > this.expireAt;
  }
}

/**
 * Armazena valor no cache.
 * @param {string} key
 * @param {*} data
 * @param {number} ttlMs - Tempo em milissegundos até expirar
 */
function set(key, data, ttlMs = 60_000) {
  cache.set(key, new CacheEntry(data, ttlMs));
}

/**
 * Recupera valor do cache se ainda válido.
 * @param {string} key
 * @returns {*|null}
 */
function get(key) {
  const entry = cache.get(key);
  if (!entry || entry.isExpired) {
    if (entry) cache.delete(key);
    return null;
  }
  return entry.data;
}

/**
 * Remove uma chave específica do cache.
 * @param {string} key
 */
function del(key) {
  cache.delete(key);
}

/**
 * Limpa todo o cache.
 */
function flush() {
  cache.clear();
}

/**
 * Middleware Express para cache: intercepta GET e retorna do cache se disponível.
 * @param {number} ttlMs
 * @param {string} [keyPrefix] - Prefixo opcional para a chave (default: req.path)
 * @returns {Function} middleware
 */
function middleware(ttlMs, keyPrefix) {
  return (req, res, next) => {
    // Só aplica a GET requests
    if (req.method !== 'GET') return next();

    const key = (keyPrefix || req.path) + JSON.stringify(req.query);
    const cached = get(key);
    if (cached) return res.json(cached);

    // Intercepta res.json para armazenar no cache
    const originalJson = res.json.bind(res);
    res.json = (body) => {
      set(key, body, ttlMs);
      return originalJson(body);
    };

    next();
  };
}

module.exports = { set, get, del, flush, middleware };