'use strict';

const Fuse = require('fuse.js');
const Recognizers = require('@microsoft/recognizers-text-suite');

const CULTURA = Recognizers.Culture.Portuguese;

/**
 * Normaliza texto: remove acentos, converte para minúsculas
 * @param {string} texto
 * @returns {string}
 */
function normalizarTexto(texto) {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/**
 * Extrai quantidade e nome do produto de um segmento de texto.
 * Usa @microsoft/recognizers-text-suite para detectar números em português.
 * @param {string} segmento
 * @returns {{ quantidade: number, nomeProduto: string }}
 */
function extrairQuantidadeEProduto(segmento) {
  const numerosEncontrados = Recognizers.recognizeNumber(segmento, CULTURA);

  let quantidade = 1;
  let textoSemNumero = segmento;

  if (numerosEncontrados.length > 0) {
    const primeiroNumero = numerosEncontrados[0];
    const valor = parseFloat(primeiroNumero.resolution.value);
    if (!isNaN(valor) && valor > 0) {
      quantidade = Math.round(valor);
      textoSemNumero = segmento.replace(primeiroNumero.text, '').trim();
    }
  }

  return {
    quantidade,
    nomeProduto: normalizarTexto(textoSemNumero),
  };
}

/**
 * Tenta fazer match de um nome de produto no Fuse e retorna confiança (0-100).
 * @param {Fuse} fuse
 * @param {string} nome
 * @returns {{ confianca: number, item: object|null }}
 */
function matchProduto(fuse, nome) {
  const matches = fuse.search(nome);
  if (matches.length === 0) return { confianca: 0, item: null };
  return {
    confianca: Math.round((1 - matches[0].score) * 100),
    item: matches[0].item,
  };
}

/**
 * Quebra o texto em segmentos de item, lidando com 3 formas de separação:
 *
 *  1. Vírgula / ponto-e-vírgula  → "2 coca, 1 agua"
 *  2. "e" antes de número        → "2 coca e 1 agua"  (o "e" vira separador)
 *  3. Número no meio sem separador → "2 coca 1 agua"  (número = início de novo item)
 *
 * O "e" dentro de um nome de produto ("Presunto e Queijo") NÃO é tocado aqui
 * porque não é seguido de um número.
 *
 * @param {string} texto
 * @returns {string[]}
 */
function segmentarTexto(texto) {
  // Passo 1: "e" imediatamente antes de um número vira vírgula
  // "2 nanaica e 4 brigadeiro" → "2 nanaica, 4 brigadeiro"
  let t = texto.replace(/\s+e\s+(?=\d)/gi, ', ');

  // Passo 2: separar por vírgula e ponto-e-vírgula
  const partesPrimarias = t.split(/[,;]/).map((s) => s.trim()).filter((s) => s.length > 1);

  // Passo 3: dentro de cada parte, dividir onde uma letra é seguida de "espaços + número + espaço"
  // Isso detecta itens sem separador: "2 nanaica 4 brigadeiro" → ["2 nanaica", "4 brigadeiro"]
  const segmentos = [];
  for (const parte of partesPrimarias) {
    // Lookbehind: posição precedida por letra (fim de palavra do produto anterior)
    // Lookahead: seguida de dígito(s) + espaço (início de quantidade do próximo item)
    const subPartes = parte.split(/(?<=[a-záéíóúâêôãõüçA-ZÁÉÍÓÚÂÊÔÃÕÜÇ])\s+(?=\d+\s)/);
    for (const sub of subPartes) {
      const s = sub.trim();
      if (s.length > 1) segmentos.push(s);
    }
  }

  return segmentos;
}

/**
 * Processa texto livre e faz fuzzy match com os produtos do banco.
 * Retorna lista de itens identificados com nível de confiança 0-100.
 *
 * Suporta todos os formatos de entrada:
 *  - "2 coca cola, 1 agua mineral"
 *  - "2 coca cola e 1 agua mineral"
 *  - "2 coca cola 1 agua mineral"
 *  - "1 presunto e queijo"  (nome de produto com "e" — não dividido)
 *
 * @param {string} texto - Texto a processar
 * @param {Array<{nome: string, preco: number, estoque: number, categoria: string}>} produtos
 * @returns {Array<{textoOriginal, produto, quantidade, confianca, encontrado}>}
 */
function processarTexto(texto, produtos) {
  const segmentos = segmentarTexto(texto);

  if (segmentos.length === 0) return [];

  const produtosNormalizados = produtos.map((p) => ({
    ...p,
    nomeNormalizado: normalizarTexto(p.nome),
  }));

  const fuse = new Fuse(produtosNormalizados, {
    keys: ['nomeNormalizado', 'nome'],
    threshold: 0.45,
    includeScore: true,
    ignoreLocation: true,
    minMatchCharLength: 2,
  });

  // Confiança mínima para cada parte ser considerada match individual
  const LIMIAR_CONFIANCA = 55;

  const resultados = [];

  for (const segmento of segmentos) {
    const { quantidade, nomeProduto } = extrairQuantidadeEProduto(segmento);

    if (!nomeProduto) continue;

    // 1. Tenta match no segmento inteiro
    const matchInteiro = matchProduto(fuse, nomeProduto);

    // 2. Se ainda contém " e " (entre palavras, sem número após), avalia se vale dividir
    //    Exemplo: "presunto e queijo" → tenta inteiro primeiro, só divide se as partes
    //    individualmente tiverem confiança MAIOR que o produto inteiro
    const contemE = /\se\s/i.test(nomeProduto);
    if (contemE) {
      const partes = nomeProduto.split(/\se\s/i).map((s) => s.trim()).filter((s) => s.length > 1);

      if (partes.length > 1) {
        const matchesDasPartes = partes.map((p) => matchProduto(fuse, p));
        const todasComBomMatch = matchesDasPartes.every((m) => m.confianca >= LIMIAR_CONFIANCA);
        const menorConfiancaSub = Math.min(...matchesDasPartes.map((m) => m.confianca));

        if (todasComBomMatch && menorConfiancaSub > matchInteiro.confianca) {
          for (let i = 0; i < partes.length; i++) {
            const m = matchesDasPartes[i];
            resultados.push({
              textoOriginal: partes[i],
              produto: m.item,
              quantidade,
              confianca: m.confianca,
              encontrado: true,
            });
          }
          continue;
        }
      }
    }

    // 3. Resultado padrão: segmento inteiro como um único produto
    if (!matchInteiro.item) {
      resultados.push({
        textoOriginal: segmento,
        produto: null,
        quantidade,
        confianca: 0,
        encontrado: false,
      });
      continue;
    }

    resultados.push({
      textoOriginal: segmento,
      produto: matchInteiro.item,
      quantidade,
      confianca: matchInteiro.confianca,
      encontrado: true,
    });
  }

  return resultados;
}

module.exports = { processarTexto, normalizarTexto, segmentarTexto };
