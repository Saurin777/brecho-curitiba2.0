let produtosAdmin = [];
let idsSelecionados = new Set();

// ===== Configuração de tamanhos por categoria =====
const CATEGORIAS_SEM_TAMANHO = ['Bolsa', 'Acessórios'];
const CATEGORIAS_CALCADO = ['Calçados'];
const CATEGORIAS_NUMERACAO_CALCA = ['Calça', 'Bermuda'];

const TAMANHOS_LETRA = ['PP', 'P', 'M', 'G', 'GG', 'XG'];
const TAMANHOS_CALCA = ['36', '38', '40', '42', '44', '46', '48', '50'];
const TAMANHOS_CALCADO = (() => {
  const lista = [];
  for (let n = 34; n <= 43; n++) lista.push(String(n));
  return lista;
})();

// Retorna { semTamanho: bool, opcoes: [...] } de acordo com a categoria escolhida
function obterConfigTamanhos(categoria) {
  if (!categoria) return { semTamanho: false, opcoes: null };
  if (CATEGORIAS_SEM_TAMANHO.includes(categoria)) return { semTamanho: true, opcoes: [] };
  if (CATEGORIAS_CALCADO.includes(categoria)) return { semTamanho: false, opcoes: TAMANHOS_CALCADO };
  if (CATEGORIAS_NUMERACAO_CALCA.includes(categoria)) return { semTamanho: false, opcoes: TAMANHOS_CALCA };
  return { semTamanho: false, opcoes: TAMANHOS_LETRA };
}

// Renderiza a área de tamanhos de acordo com a categoria, pré-preenchendo quantidades já existentes (edição)
function renderizarAreaTamanhos(categoria, valoresAtuais) {
  valoresAtuais = valoresAtuais || {};
  const area = document.getElementById('areaTamanhos');
  if (!area) return;

  if (!categoria) {
    area.innerHTML = '<p class="aviso-tamanho">Selecione uma categoria para escolher os tamanhos.</p>';
    return;
  }

  const config = obterConfigTamanhos(categoria);

  if (config.semTamanho) {
    area.innerHTML = '<p class="aviso-tamanho">Essa categoria não usa tamanhos/numeração.</p>';
    return;
  }

  area.innerHTML = `
    <div class="grade-tamanhos-admin">
      ${config.opcoes.map(tam => `
        <div class="tamanho-admin-item">
          <span class="tamanho-admin-label">${tam}</span>
          <input type="number" class="input-tamanho-qtd" data-tamanho="${tam}" min="0" step="1"
                 value="${valoresAtuais[tam] ? valoresAtuais[tam] : ''}" placeholder="0">
        </div>
      `).join('')}
    </div>
  `;
}

// Lê os inputs de quantidade da área de tamanhos e monta a string "TAM:QTD,TAM:QTD"
function lerTamanhosDoFormulario() {
  const inputs = document.querySelectorAll('#areaTamanhos .input-tamanho-qtd');
  const partes = [];
  inputs.forEach(input => {
    const qtd = parseInt(input.value, 10);
    if (qtd > 0) partes.push(`${input.dataset.tamanho}:${qtd}`);
  });
  return partes.join(',');
}

// ===== Fotos já cadastradas (na edição) =====
function renderizarFotosAtuais(produtoId, imagens) {
  const campo = document.getElementById('campoFotosAtuais');
  const area = document.getElementById('areaFotosAtuais');
  const labelImagens = document.getElementById('labelImagens');
  if (!campo || !area) return;

  imagens = imagens || [];

  if (!produtoId || imagens.length === 0) {
    campo.style.display = 'none';
    area.innerHTML = '';
    if (labelImagens) labelImagens.textContent = 'Fotos (pode selecionar várias)';
    return;
  }

  campo.style.display = 'block';
  if (labelImagens) labelImagens.textContent = 'Adicionar novas fotos';

  area.innerHTML = imagens.map(url => `
    <div class="foto-atual-item" data-url="${url}">
      <img src="${url}" alt="Foto da peça">
      <button type="button" class="btn-remover-foto" title="Excluir esta foto" data-id="${produtoId}" data-url="${url}">&times;</button>
    </div>
  `).join('');

  area.querySelectorAll('.btn-remover-foto').forEach(btn => {
    btn.addEventListener('click', () => excluirImagemProduto(btn.dataset.id, btn.dataset.url));
  });
}

async function excluirImagemProduto(produtoId, url) {
  const confirmado = await confirmarAcao('Tem certeza que deseja excluir esta foto?', 'Excluir');
  if (!confirmado) return;
  try {
    const produtoAtualizado = await apiFetch(`/api/produtos/${produtoId}/imagens`, {
      method: 'DELETE',
      body: JSON.stringify({ url })
    });
    renderizarFotosAtuais(produtoId, produtoAtualizado.images || []);
    await carregarProdutosAdmin();
  } catch (err) {
    mostrarNotificacao(err.message, 'erro');
  }
}

// ===== Histórico de movimentação de uma peça =====
// (movida para public/js/pedidos.js, junto com a página Pedidos/Vendas)

function renderizarLinhaProduto(produto) {
  const imagem = produto.images && produto.images[0]
    ? `<img src="${produto.images[0]}" alt="${produto.name}">`
    : `<div style="width:46px;height:56px;background:var(--laranja-suave);border-radius:6px;"></div>`;

  const marcado = idsSelecionados.has(String(produto.id));

  return `
    <tr data-id="${produto.id}" class="${marcado ? 'linha-selecionada' : ''}">
      <td class="col-check"><input type="checkbox" class="checkbox-linha" data-id="${produto.id}" ${marcado ? 'checked' : ''}></td>
      <td>${imagem}</td>
      <td>${produto.name}</td>
      <td>${produto.category || '-'}</td>
      <td>
        ${emPromocao(produto)
          ? `<span class="preco-antigo">${formatarPreco(produto.promo.originalPrice)}</span>
             <strong>${formatarPreco(produto.price)}</strong>
             <span class="marca-status" title="Peça em promoção">promo</span>`
          : formatarPreco(produto.price)}
      </td>
      <td>${produto.featured ? `Sim${statusAtivo(produto) ? ' <span class="marca-status" title="Aparece no status da logo por 24h">no status</span>' : ''}` : 'Não'}</td>
      <td class="acoes-linha">
        <button class="btn btn-secundario btn-editar" data-id="${produto.id}">Editar</button>
        <button class="btn btn-perigo btn-excluir" data-id="${produto.id}">Excluir</button>
      </td>
    </tr>
  `;
}

// A peça fica no "status" da logo por 24h depois de entrar nos destaques
function statusAtivo(produto) {
  if (!produto.featured || !produto.featuredAt) return false;
  return (Date.now() - new Date(produto.featuredAt).getTime()) < 24 * 60 * 60 * 1000;
}

async function carregarProdutosAdmin() {
  produtosAdmin = await apiFetch('/api/produtos');
  const idsAtuais = new Set(produtosAdmin.map(p => String(p.id)));
  idsSelecionados.forEach(id => { if (!idsAtuais.has(id)) idsSelecionados.delete(id); });

  const corpo = document.getElementById('corpoTabelaProdutos');
  corpo.innerHTML = produtosAdmin.map(renderizarLinhaProduto).join('');

  document.querySelectorAll('.btn-editar').forEach(btn => {
    btn.addEventListener('click', () => preencherFormularioEdicao(btn.dataset.id));
  });
  document.querySelectorAll('.btn-excluir').forEach(btn => {
    btn.addEventListener('click', () => excluirProduto(btn.dataset.id));
  });
  document.querySelectorAll('.checkbox-linha').forEach(chk => {
    chk.addEventListener('change', () => {
      const id = chk.dataset.id;
      if (chk.checked) idsSelecionados.add(id);
      else idsSelecionados.delete(id);
      chk.closest('tr').classList.toggle('linha-selecionada', chk.checked);
      atualizarBarraAcoesLote();
    });
  });

  atualizarCheckTodos();
  atualizarBarraAcoesLote();
}

function atualizarCheckTodos() {
  const checkTodos = document.getElementById('checkTodos');
  if (!checkTodos) return;
  const total = produtosAdmin.length;
  checkTodos.checked = total > 0 && idsSelecionados.size === total;
  checkTodos.indeterminate = idsSelecionados.size > 0 && idsSelecionados.size < total;
}

function atualizarBarraAcoesLote() {
  const barra = document.getElementById('barraAcoesLote');
  const contador = document.getElementById('contadorSelecionados');
  if (!barra || !contador) return;
  const qtd = idsSelecionados.size;
  if (qtd > 0) {
    contador.textContent = `${qtd} ${qtd === 1 ? 'selecionada' : 'selecionadas'}`;
    barra.style.display = 'flex';
  } else {
    barra.style.display = 'none';
  }
}

function ativarSelecaoLote() {
  const checkTodos = document.getElementById('checkTodos');
  if (checkTodos) {
    checkTodos.addEventListener('change', () => {
      if (checkTodos.checked) {
        produtosAdmin.forEach(p => idsSelecionados.add(String(p.id)));
      } else {
        idsSelecionados.clear();
      }
      document.querySelectorAll('.checkbox-linha').forEach(chk => {
        chk.checked = checkTodos.checked;
        chk.closest('tr').classList.toggle('linha-selecionada', checkTodos.checked);
      });
      atualizarBarraAcoesLote();
    });
  }

  const btnExcluirSelecionados = document.getElementById('btnExcluirSelecionados');
  if (btnExcluirSelecionados) {
    btnExcluirSelecionados.addEventListener('click', excluirSelecionados);
  }
}

async function excluirSelecionados() {
  const qtd = idsSelecionados.size;
  if (qtd === 0) return;
  const confirmado = await confirmarAcao(
    `Tem certeza que deseja excluir ${qtd} ${qtd === 1 ? 'peça' : 'peças'}? Essa ação não pode ser desfeita.`,
    'Excluir'
  );
  if (!confirmado) return;

  try {
    await Promise.all([...idsSelecionados].map(id => apiFetch(`/api/produtos/${id}`, { method: 'DELETE' })));
    idsSelecionados.clear();
    await carregarProdutosAdmin();
  } catch (err) {
    mostrarNotificacao(err.message, 'erro');
    await carregarProdutosAdmin();
  }
}

function objetoTamanhosParaTexto(sizes) {
  if (!sizes) return '';
  return Object.entries(sizes).map(([tam, qtd]) => `${tam}:${qtd}`).join(',');
}

function preencherFormularioEdicao(id) {
  const produto = produtosAdmin.find(p => p.id === Number(id));
  if (!produto) return;

  document.getElementById('tituloFormProduto').textContent = `Editando: ${produto.name}`;
  document.getElementById('produtoEditandoId').value = produto.id;
  document.getElementById('nome').value = produto.name;
  document.getElementById('categoria').value = produto.category || '';
  document.getElementById('descricao').value = produto.description || '';
  document.getElementById('preco').value = produto.price;
  renderizarAreaTamanhos(produto.category || '', produto.sizes || {});
  renderizarFotosAtuais(produto.id, produto.images || []);
  document.getElementById('destaque').checked = !!produto.featured;
  document.getElementById('btnSalvarProduto').textContent = 'Salvar alterações';
  document.getElementById('btnCancelarEdicao').style.display = 'inline-flex';

  irParaAbaAdmin('novaPeca');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function limparFormularioProduto() {
  document.getElementById('formProduto').reset();
  document.getElementById('produtoEditandoId').value = '';
  document.getElementById('tituloFormProduto').textContent = 'Nova peça';
  document.getElementById('btnSalvarProduto').textContent = 'Salvar peça';
  document.getElementById('btnCancelarEdicao').style.display = 'none';
  renderizarAreaTamanhos('');
  renderizarFotosAtuais(null, []);
}

async function salvarProduto(e) {
  e.preventDefault();

  const id = document.getElementById('produtoEditandoId').value;
  const formData = new FormData();
  formData.append('name', document.getElementById('nome').value.trim());
  formData.append('description', document.getElementById('descricao').value.trim());
  formData.append('price', document.getElementById('preco').value);
  formData.append('category', document.getElementById('categoria').value.trim());
  formData.append('sizes', lerTamanhosDoFormulario());
  formData.append('featured', document.getElementById('destaque').checked);

  const arquivos = document.getElementById('imagens').files;
  for (const arquivo of arquivos) {
    formData.append('images', arquivo);
  }

  try {
    if (id) {
      await apiFetch(`/api/produtos/${id}`, { method: 'PUT', body: formData });
    } else {
      await apiFetch('/api/produtos', { method: 'POST', body: formData });
    }
    limparFormularioProduto();
    await carregarProdutosAdmin();
    if (!id) window.irParaAbaAdmin('pecasCadastradas');
  } catch (err) {
    mostrarNotificacao(err.message, 'erro');
  }
}

async function excluirProduto(id) {
  const confirmado = await confirmarAcao('Tem certeza que deseja excluir esta peça? Essa ação não pode ser desfeita.', 'Excluir');
  if (!confirmado) return;
  try {
    await apiFetch(`/api/produtos/${id}`, { method: 'DELETE' });
    idsSelecionados.delete(String(id));
    await carregarProdutosAdmin();
  } catch (err) {
    mostrarNotificacao(err.message, 'erro');
  }
}

async function salvarConfiguracoes(e) {
  e.preventDefault();

  const formData = new FormData();
  formData.append('nomeLoja', document.getElementById('nomeLoja').value.trim());
  formData.append('whatsapp', document.getElementById('whatsapp').value.trim());
  formData.append('instagram', document.getElementById('instagram').value.trim());

  const arquivoLogo = document.getElementById('logo').files[0];
  if (arquivoLogo) formData.append('logo', arquivoLogo);

  try {
    await apiFetch('/api/configuracoes', { method: 'PUT', body: formData });
    const sucesso = document.getElementById('mensagemConfigSucesso');
    sucesso.textContent = 'Configurações salvas com sucesso!';
    sucesso.style.display = 'block';
    setTimeout(() => { sucesso.style.display = 'none'; }, 3000);
  } catch (err) {
    mostrarNotificacao(err.message, 'erro');
  }
}

function preencherFormularioConfiguracoes() {
  document.getElementById('nomeLoja').value = configuracoesSite.nomeLoja || '';
  document.getElementById('whatsapp').value = configuracoesSite.whatsapp || '';
  document.getElementById('instagram').value = configuracoesSite.instagram || '';
}

function ativarAbas() {
  const mapaAbas = {
    novaPeca: 'secaoNovaPeca',
    pecasCadastradas: 'secaoPecasCadastradas',
    configuracoes: 'secaoConfiguracoes'
  };

  window.irParaAbaAdmin = function irParaAbaAdmin(nomeAba) {
    const alvo = mapaAbas[nomeAba];
    if (!alvo) return;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('ativa', b.dataset.tab === nomeAba));
    document.querySelectorAll('.admin-secao').forEach(s => s.classList.remove('ativa'));
    document.getElementById(alvo).classList.add('ativa');
  };

  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => window.irParaAbaAdmin(btn.dataset.tab));
  });

  // permite abrir uma aba específica via link, ex: admin.html?aba=configuracoes
  const abaSolicitada = new URLSearchParams(window.location.search).get('aba');
  if (abaSolicitada && mapaAbas[abaSolicitada]) window.irParaAbaAdmin(abaSolicitada);
}

async function iniciarAdmin() {
  await montarCabecalho();
  montarRodape();

  if (!usuarioAtual || !usuarioAtual.isAdmin) {
    document.getElementById('avisoAcesso').style.display = 'block';
    if (!usuarioAtual) window.location.href = '/login.html';
    return;
  }

  document.getElementById('areaAdmin').style.display = 'block';

  ativarAbas();
  ativarSelecaoLote();
  await carregarProdutosAdmin();
  preencherFormularioConfiguracoes();

  document.getElementById('formProduto').addEventListener('submit', salvarProduto);
  document.getElementById('btnCancelarEdicao').addEventListener('click', limparFormularioProduto);
  document.getElementById('btnNovaPeca').addEventListener('click', () => {
    limparFormularioProduto();
    irParaAbaAdmin('novaPeca');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
  document.getElementById('formConfiguracoes').addEventListener('submit', salvarConfiguracoes);
  document.getElementById('categoria').addEventListener('change', (e) => renderizarAreaTamanhos(e.target.value));
}

iniciarAdmin();
