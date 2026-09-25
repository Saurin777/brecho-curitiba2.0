let produtosAdmin = [];
let idsSelecionados = new Set();
let categoriasAdmin = [];

function renderizarCategoriasAdmin(valorAtual) {
  const select = document.getElementById('categoria');
  if (!select) return;
  select.innerHTML = '<option value="">Selecione...</option>' + categoriasAdmin.map(c => `<option value="${escaparHtml(c)}">${escaparHtml(c)}</option>`).join('');
  if (valorAtual && !categoriasAdmin.includes(valorAtual)) select.insertAdjacentHTML('beforeend', `<option value="${escaparHtml(valorAtual)}">${escaparHtml(valorAtual)} (categoria atual)</option>`);
  select.value = valorAtual || '';
}

function renderizarEditorCategorias() {
  document.getElementById('listaEdicaoCategorias').innerHTML = categoriasAdmin.map((c, i) => `<div class="categoria-editavel"><span>${escaparHtml(c)}</span><button type="button" class="btn-remover-categoria" data-index="${i}" aria-label="Excluir ${escaparHtml(c)}">×</button></div>`).join('');
  document.querySelectorAll('.btn-remover-categoria').forEach(btn => btn.addEventListener('click', () => {
    categoriasAdmin.splice(Number(btn.dataset.index), 1); renderizarEditorCategorias();
  }));
}


// ===== Clientes (somente administrador) =====
let clientesAdmin = [];

function escaparAtributo(valor) {
  return escaparHtml(valor).replace(/`/g, '&#96;');
}

function formatarDataCadastro(data) {
  if (!data) return '-';
  const d = new Date(data);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatarCelularAdmin(phone) {
  if (!phone) return '-';
  const n = String(phone).replace(/\D/g, '');
  if (n.length === 11) return `(${n.slice(0,2)}) ${n.slice(2,7)}-${n.slice(7)}`;
  if (n.length === 10) return `(${n.slice(0,2)}) ${n.slice(2,6)}-${n.slice(6)}`;
  return n;
}

function renderizarLinhaCliente(cliente) {
  const contato = cliente.email || cliente.phone || '-';
  return `
    <tr data-cliente-id="${cliente.id}">
      <td><strong>${escaparHtml(cliente.name)}</strong></td>
      <td>${escaparHtml(cliente.email || '-')}</td>
      <td>${escaparHtml(formatarCelularAdmin(cliente.phone))}</td>
      <td>${formatarDataCadastro(cliente.createdAt)}</td>
      <td class="acoes-linha">
        <button type="button" class="btn btn-secundario btn-editar-cliente" data-id="${cliente.id}">Editar</button>
        <button type="button" class="btn btn-perigo btn-excluir-cliente" data-id="${cliente.id}">Excluir</button>
      </td>
    </tr>`;
}

function abrirEditorCliente(cliente) {
  const overlay = document.createElement('div');
  overlay.className = 'overlay-confirmacao overlay-editor-cliente';
  overlay.innerHTML = `
    <div class="caixa-confirmacao caixa-editor-cliente">
      <h2>Editar cliente</h2>
      <p class="cliente-editor-subtitulo">Atualize os dados usados para entrar na conta.</p>
      <form id="formEditarCliente" class="form-editor-cliente">
        <div class="campo"><label for="editarClienteNome">Nome</label><input id="editarClienteNome" type="text" maxlength="100" value="${escaparAtributo(cliente.name)}" required></div>
        <div class="grid-2">
          <div class="campo"><label for="editarClienteEmail">E-mail</label><input id="editarClienteEmail" type="email" value="${escaparAtributo(cliente.email || '')}" placeholder="cliente@email.com"></div>
          <div class="campo"><label for="editarClientePhone">Celular</label><input id="editarClientePhone" type="tel" value="${escaparAtributo(cliente.phone || '')}" placeholder="(41) 99999-9999"></div>
        </div>
        <p class="cliente-editor-ajuda">A conta precisa ter pelo menos um contato: e-mail ou celular.</p>
        <div class="acoes-confirmacao">
          <button type="button" class="btn btn-outline" id="btnCancelarEditorCliente">Cancelar</button>
          <button type="submit" class="btn btn-primario">Salvar alterações</button>
        </div>
      </form>
    </div>`;
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('mostrar'));

  const fechar = () => {
    overlay.classList.remove('mostrar');
    setTimeout(() => overlay.remove(), 180);
  };
  overlay.querySelector('#btnCancelarEditorCliente').addEventListener('click', fechar);
  overlay.addEventListener('click', e => { if (e.target === overlay) fechar(); });
  overlay.querySelector('#formEditarCliente').addEventListener('submit', async e => {
    e.preventDefault();
    const btn = e.currentTarget.querySelector('button[type="submit"]');
    btn.disabled = true;
    try {
      await apiFetch(`/api/usuarios/${cliente.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: document.getElementById('editarClienteNome').value.trim(),
          email: document.getElementById('editarClienteEmail').value.trim(),
          phone: document.getElementById('editarClientePhone').value.trim()
        })
      });
      fechar();
      mostrarNotificacao('Cliente atualizado com sucesso!');
      await carregarClientesAdmin();
    } catch (err) {
      mostrarNotificacao(err.message, 'erro');
      btn.disabled = false;
    }
  });
}

async function excluirCliente(id) {
  const cliente = clientesAdmin.find(c => Number(c.id) === Number(id));
  if (!cliente) return;
  const confirmado = await confirmarAcao(
    `Excluir a conta de ${escaparHtml(cliente.name)}? O acesso será removido e esta ação não pode ser desfeita.`,
    'Excluir cliente'
  );
  if (!confirmado) return;
  try {
    await apiFetch(`/api/usuarios/${id}`, { method: 'DELETE' });
    mostrarNotificacao('Cliente excluído com sucesso!');
    await carregarClientesAdmin();
  } catch (err) {
    mostrarNotificacao(err.message, 'erro');
  }
}

async function carregarClientesAdmin() {
  const corpo = document.getElementById('corpoTabelaClientes');
  if (!corpo) return;
  try {
    clientesAdmin = await apiFetch('/api/usuarios');
    const vazio = document.getElementById('clientesVazio');
    corpo.innerHTML = clientesAdmin.map(renderizarLinhaCliente).join('');
    if (vazio) vazio.style.display = clientesAdmin.length ? 'none' : 'block';

    corpo.querySelectorAll('.btn-editar-cliente').forEach(btn => {
      btn.addEventListener('click', () => {
        const cliente = clientesAdmin.find(c => Number(c.id) === Number(btn.dataset.id));
        if (cliente) abrirEditorCliente(cliente);
      });
    });
    corpo.querySelectorAll('.btn-excluir-cliente').forEach(btn => {
      btn.addEventListener('click', () => excluirCliente(btn.dataset.id));
    });
  } catch (err) {
    mostrarNotificacao(err.message, 'erro');
  }
}

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

async function salvarAcessoAdmin(e) {
  e.preventDefault();

  const email = document.getElementById('adminNovoEmail').value.trim();
  const senha = document.getElementById('adminNovaSenha').value;

  try {
    await apiFetch('/api/configuracoes/admin', {
      method: 'PUT',
      body: JSON.stringify({ email, senha })
    });
    document.getElementById('formAdminAcesso').reset();
    const sucesso = document.getElementById('mensagemAdminAcessoSucesso');
    sucesso.textContent = 'Login e senha do administrador atualizados com sucesso!';
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
    configuracoes: 'secaoConfiguracoes',
    clientes: 'secaoClientes'
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
  await carregarClientesAdmin();
  preencherFormularioConfiguracoes();

  document.getElementById('formProduto').addEventListener('submit', salvarProduto);
  document.getElementById('btnCancelarEdicao').addEventListener('click', limparFormularioProduto);
  document.getElementById('btnNovaPeca').addEventListener('click', () => {
    limparFormularioProduto();
    irParaAbaAdmin('novaPeca');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
  document.getElementById('formConfiguracoes').addEventListener('submit', salvarConfiguracoes);
  document.getElementById('formAdminAcesso').addEventListener('submit', salvarAcessoAdmin);
  document.getElementById('btnAtualizarClientes').addEventListener('click', carregarClientesAdmin);
  document.getElementById('categoria').addEventListener('change', (e) => renderizarAreaTamanhos(e.target.value));
  categoriasAdmin = configuracoesSite.categorias || [];
  renderizarCategoriasAdmin();
  document.getElementById('btnEditarCategorias').addEventListener('click', () => {
    const editor = document.getElementById('editorCategorias'); editor.hidden = !editor.hidden;
    if (!editor.hidden) renderizarEditorCategorias();
  });
  document.getElementById('btnAdicionarCategoria').addEventListener('click', () => {
    const input = document.getElementById('novaCategoria'); const nome = input.value.trim();
    if (!nome) return;
    if (categoriasAdmin.some(c => c.toLocaleLowerCase() === nome.toLocaleLowerCase())) return mostrarNotificacao('Essa categoria já existe.', 'erro');
    categoriasAdmin.push(nome); input.value = ''; renderizarEditorCategorias();
  });
  document.getElementById('btnSalvarCategorias').addEventListener('click', async () => {
    try {
      configuracoesSite = await apiFetch('/api/configuracoes', { method: 'PUT', body: JSON.stringify({ categorias: categoriasAdmin }) });
      renderizarCategoriasAdmin(document.getElementById('categoria').value);
      mostrarNotificacao('Categorias salvas com sucesso!');
    } catch (err) { mostrarNotificacao(err.message, 'erro'); }
  });
}

iniciarAdmin();
