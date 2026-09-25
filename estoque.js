// estoque.js - regras de estoque por tamanho, usadas pelas rotas.
//
// Regra principal: uma peça só é considerada VENDIDA quando foi vendida E o
// estoque de todos os tamanhos zerou. Enquanto ainda houver unidades em algum
// tamanho, ela continua disponível para outros clientes; o tamanho que zerou
// é que fica desativado (ofuscado) na página da peça.

// Peças sem numeração (bolsas, acessórios) não têm grade de tamanhos.
function temGradeDeTamanhos(produto) {
  return !!(produto && produto.sizes && Object.keys(produto.sizes).length > 0);
}

function estoqueTotal(produto) {
  if (!temGradeDeTamanhos(produto)) return 0;
  return Object.values(produto.sizes).reduce((soma, qtd) => soma + (Number(qtd) || 0), 0);
}

// Quantas unidades existem de um tamanho. null = tamanho não controlado (ex.: "Único").
function estoqueDoTamanho(produto, tamanho) {
  if (!temGradeDeTamanhos(produto)) return null;
  if (!Object.prototype.hasOwnProperty.call(produto.sizes, tamanho)) return null;
  return Number(produto.sizes[tamanho]) || 0;
}

// Esgotada = tem grade de tamanhos e todos estão zerados.
function estaEsgotada(produto) {
  return temGradeDeTamanhos(produto) && estoqueTotal(produto) === 0;
}

// Vendida = foi marcada como vendida e não sobrou nenhuma unidade em nenhum tamanho.
function estaVendida(produto) {
  return !!(produto && produto.soldAt) && !(temGradeDeTamanhos(produto) && estoqueTotal(produto) > 0);
}

module.exports = { temGradeDeTamanhos, estoqueTotal, estoqueDoTamanho, estaEsgotada, estaVendida };
