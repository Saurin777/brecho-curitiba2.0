let produtoAtual = null;
let tamanhoSelecionado = null;
let timerPromocao = null;
let favoritosIdsRelacionados = [];

// ---------------------------------------------------------------------------
// "Outras peças" — vitrine de produtos relacionados abaixo do produto atual,
// para o cliente continuar navegando sem precisar voltar para o início.
// Nunca mostra a própria peça que o cliente já está vendo.
// ---------------------------------------------------------------------------
function renderizarCardRelacionado(produto) {
  const imagem = produto.images && produto.images[0]
    ? `<img class="imagem-produto" src="${produto.images[0]}" alt="${escaparHtml(produto.name)}">`
    : `<div class="sem-imagem">Sem foto ainda</div>`;

  const ehFavorito = favoritosIdsRelacionados.includes(produto.id);
  const ehDestaque = !!produto.featured;
  const selo = ehDestaque ? `<span class="selo-destaque">${ICONES.estrela || '★'} Destaque</span>` : '';
  const seloVendida = produto.vendida ? `<span class="selo-vendida" aria-label="VENDIDO">VENDIDO</span>` : '';

  return `
    <div class="card-produto ${ehDestaque ? 'card-produto--destaque' : ''} ${produto.vendida ? 'card-produto--vendida' : ''}" data-id="${produto.id}" ${produto.vendida ? '' : `role="link" tabindex="0" aria-label="Ver detalhes de ${escaparHtml(produto.name)}"`}>
      <div class="imagem-wrap">
        ${imagem}
        ${produto.vendida ? `<div class="camada-vendida"></div>` : ''}
        ${selo}
        ${seloVendida}
        <button class="btn-favorito ${ehFavorito ? 'ativo' : ''}" data-id="${produto.id}" title="Favoritar">
          ${ICONES.coracao}
        </button>
      </div>
      <div class="info">
        ${produto.vendida ? '' : `<div class="categoria">${produto.category || ''}</div>`}
        <div class="nome">${escaparHtml(produto.name)}</div>
        ${produto.vendida ? '' : blocoPreco(produto)}
        ${produto.vendida ? '' : `<a href="/produto.html?id=${produto.id}" class="btn btn-primario btn-bloco">Ver detalhes</a>`}
      </div>
    </div>
  `;
}

function ativarAcoesCardRelacionado(container) {
  container.querySelectorAll('.card-produto:not(.card-produto--vendida)').forEach(card => {
    const abrir = () => { window.location.href = `/produto.html?id=${card.dataset.id}`; };
    card.addEventListener('click', e => { if (!e.target.closest('a, button')) abrir(); });
    card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); abrir(); } });
  });
  container.querySelectorAll('.card-produto .btn-bloco').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      window.location.href = link.getAttribute('href');
    });
  });
  container.querySelectorAll('.btn-favorito').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      if (!usuarioAtual) { window.location.href = '/login.html'; return; }
      const id = Number(btn.dataset.id);
      const ativo = btn.classList.contains('ativo');
      try {
        if (ativo) {
          await apiFetch(`/api/favoritos/${id}`, { method: 'DELETE' });
          favoritosIdsRelacionados = favoritosIdsRelacionados.filter(f => f !== id);
        } else {
          await apiFetch(`/api/favoritos/${id}`, { method: 'POST' });
          favoritosIdsRelacionados.push(id);
        }
        document.querySelectorAll(`.btn-favorito[data-id="${id}"]`).forEach(b => b.classList.toggle('ativo', !ativo));
        atualizarBadgesContagem();
      } catch (err) {
        mostrarNotificacao(err.message, 'erro');
      }
    });
  });
}

async function carregarProdutosRelacionados(idAtual) {
  const secao = document.getElementById('secaoRelacionados');
  const grade = document.getElementById('gradeRelacionados');
  if (!secao || !grade) return;

  try {
    const todos = await apiFetch('/api/produtos');
    const outros = todos.filter(p => p.id !== idAtual);
    if (!outros.length) return;

    if (usuarioAtual) {
      try {
        const favoritos = await apiFetch('/api/favoritos');
        favoritosIdsRelacionados = favoritos.map(f => f.id);
      } catch (e) { /* ignora */ }
    }

    grade.innerHTML = outros.map(renderizarCardRelacionado).join('');
    ativarAcoesCardRelacionado(grade);
    secao.style.display = 'block';
  } catch (e) { /* se falhar, simplesmente não mostra a seção */ }
}

// ---------------------------------------------------------------------------
// Preço da peça + edição de promoção (o lápis só aparece para o administrador)
// ---------------------------------------------------------------------------
const ICONE_LAPIS = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>`;

function renderizarPreco() {
  const area = document.getElementById('areaPreco');
  if (!area) return;

  clearInterval(timerPromocao);
  const ehAdmin = !!(usuarioAtual && usuarioAtual.isAdmin);
  const promo = emPromocao(produtoAtual);

  const lapis = ehAdmin
    ? `<button type="button" class="btn-lapis-preco" id="btnEditarPreco"
         title="${promo ? 'Editar promoção' : 'Colocar em promoção'}"
         aria-label="Editar preço">${ICONE_LAPIS}</button>`
    : '';

  const cronometro = promo && produtoAtual.promo.endsAt
    ? `<div class="promo-cronometro" id="promoCronometro"></div>`
    : '';

  area.innerHTML = promo
    ? `
      <div class="linha-preco">
        <span class="produto-preco-antigo">${formatarPreco(produtoAtual.promo.originalPrice)}</span>
        <span class="produto-preco produto-preco-promo">${formatarPreco(produtoAtual.price)}</span>
        <span class="selo-promocao selo-promocao-grande">-${percentualDesconto(produtoAtual)}%</span>
        ${lapis}
      </div>
      ${cronometro}
    `
    : `
      <div class="linha-preco">
        <span class="produto-preco">${formatarPreco(produtoAtual.price)}</span>
        ${lapis}
      </div>
    `;

  const btn = document.getElementById('btnEditarPreco');
  if (btn) btn.addEventListener('click', abrirEditorPreco);

  if (promo && produtoAtual.promo.endsAt) iniciarCronometro();
}

// Atualiza o "termina em ..." a cada segundo; quando zera, recarrega a peça
// (o servidor já devolveu o preço cheio nesse momento).
function iniciarCronometro() {
  const el = document.getElementById('promoCronometro');
  if (!el) return;

  const tick = async () => {
    const texto = contagemRegressiva(produtoAtual.promo.endsAt);
    if (!texto) {
      clearInterval(timerPromocao);
      try {
        produtoAtual = await apiFetch(`/api/produtos/${produtoAtual.id}`);
      } catch (e) { /* ignora */ }
      renderizarPreco();
      mostrarNotificacao('A promoção terminou — o preço voltou ao normal.');
      return;
    }
    el.innerHTML = `⏳ Promoção termina em <strong>${texto}</strong>`;
  };

  tick();
  timerPromocao = setInterval(tick, 1000);
}

function abrirEditorPreco() {
  const promo = emPromocao(produtoAtual);
  const precoCheio = promo ? produtoAtual.promo.originalPrice : produtoAtual.price;

  const overlay = document.createElement('div');
  overlay.className = 'overlay-confirmacao mostrar';
  overlay.innerHTML = `
    <div class="caixa-confirmacao caixa-promocao">
      <h3 class="titulo-promocao">${promo ? 'Editar promoção' : 'Colocar em promoção'}</h3>
      <p class="ajuda-promocao">Preço normal da peça: <strong>${formatarPreco(precoCheio)}</strong></p>

      <label class="rotulo-promocao" for="campoPrecoPromo">Preço promocional (R$)</label>
      <input type="number" id="campoPrecoPromo" class="campo-promocao" step="0.01" min="0.01"
             value="${produtoAtual.price.toFixed(2)}">
      <p class="ajuda-promocao ajuda-discreta">
        Colocar de volta ${formatarPreco(precoCheio)} (ou mais) encerra a promoção.
      </p>

      <label class="linha-checkbox">
        <input type="checkbox" id="usarTemporizador" ${promo && produtoAtual.promo.endsAt ? 'checked' : ''}>
        <span>Definir duração da promoção</span>
      </label>

      <div id="blocoDuracao" class="bloco-duracao" style="display:none">
        <label class="rotulo-promocao" for="campoHoras">Duração</label>
        <select id="campoHoras" class="campo-promocao">
          <option value="1">1 hora</option>
          <option value="6">6 horas</option>
          <option value="12">12 horas</option>
          <option value="24" selected>24 horas</option>
          <option value="48">2 dias</option>
          <option value="72">3 dias</option>
          <option value="168">7 dias</option>
        </select>
        <p class="ajuda-promocao ajuda-discreta">Quando o tempo acabar, o preço volta sozinho ao normal.</p>
      </div>

      <div class="acoes-confirmacao">
        ${promo ? `<button type="button" class="btn btn-perigo" id="btnEncerrarPromo">Encerrar promoção</button>` : ''}
        <button type="button" class="btn btn-outline" id="btnCancelarPromo">Cancelar</button>
        <button type="button" class="btn btn-primario" id="btnSalvarPromo">Salvar</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const checkbox = overlay.querySelector('#usarTemporizador');
  const blocoDuracao = overlay.querySelector('#blocoDuracao');
  const alternarDuracao = () => { blocoDuracao.style.display = checkbox.checked ? 'block' : 'none'; };
  checkbox.addEventListener('change', alternarDuracao);
  alternarDuracao();

  const fechar = () => overlay.remove();
  overlay.querySelector('#btnCancelarPromo').addEventListener('click', fechar);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) fechar(); });

  const campoPreco = overlay.querySelector('#campoPrecoPromo');
  campoPreco.focus();
  campoPreco.select();

  overlay.querySelector('#btnSalvarPromo').addEventListener('click', async () => {
    const valor = parseFloat(campoPreco.value);
    if (!isFinite(valor) || valor <= 0) {
      mostrarNotificacao('Informe um preço válido.', 'erro');
      return;
    }
    const corpo = { price: valor };
    if (checkbox.checked) corpo.durationHours = Number(overlay.querySelector('#campoHoras').value);

    try {
      const resposta = await apiFetch(`/api/produtos/${produtoAtual.id}/promocao`, {
        method: 'PUT',
        body: JSON.stringify(corpo)
      });
      produtoAtual = resposta.produto;
      fechar();
      renderizarPreco();
      mostrarNotificacao(resposta.promocaoEncerrada
        ? 'Promoção encerrada — o preço voltou ao normal.'
        : 'Promoção ativada! 🏷️');
    } catch (err) {
      mostrarNotificacao(err.message, 'erro');
    }
  });

  const btnEncerrar = overlay.querySelector('#btnEncerrarPromo');
  if (btnEncerrar) {
    btnEncerrar.addEventListener('click', async () => {
      try {
        const resposta = await apiFetch(`/api/produtos/${produtoAtual.id}/promocao`, { method: 'DELETE' });
        produtoAtual = resposta.produto;
        fechar();
        renderizarPreco();
        mostrarNotificacao('Promoção encerrada — o preço voltou ao normal.');
      } catch (err) {
        mostrarNotificacao(err.message, 'erro');
      }
    });
  }
}

function trocarImagemPrincipal(url) {
  document.getElementById('imgPrincipal').src = url;
  document.querySelectorAll('.galeria-miniaturas img').forEach(img => {
    img.classList.toggle('ativa', img.src.includes(url));
  });
}

// Faz o zoom da imagem principal acompanhar a posição do mouse (efeito de lupa)
function ativarZoomComMouse() {
  const galeria = document.querySelector('.galeria-principal');
  const imgPrincipal = document.getElementById('imgPrincipal');
  if (!galeria || !imgPrincipal) return;

  galeria.addEventListener('mousemove', (e) => {
    const rect = galeria.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    imgPrincipal.style.transformOrigin = `${Math.max(0, Math.min(100, x))}% ${Math.max(0, Math.min(100, y))}%`;
  });

  galeria.addEventListener('mouseleave', () => {
    imgPrincipal.style.transformOrigin = 'center';
  });
}

async function iniciarProduto() {
  await montarCabecalho();
  montarRodape();

  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');
  const container = document.getElementById('conteudoProduto');

  if (!id) {
    container.innerHTML = '<p>Produto não encontrado.</p>';
    return;
  }

  try {
    produtoAtual = await apiFetch(`/api/produtos/${id}`);
  } catch (e) {
    container.innerHTML = '<p>Este produto não existe mais.</p>';
    return;
  }

  const produtoVendido = !!produtoAtual.vendida;

  let favoritosIds = [];
  if (usuarioAtual) {
    try {
      const favoritos = await apiFetch('/api/favoritos');
      favoritosIds = favoritos.map(f => f.id);
    } catch (e) {}
  }
  const ehFavorito = favoritosIds.includes(produtoAtual.id);

  const imagens = produtoAtual.images && produtoAtual.images.length ? produtoAtual.images : [];
  const imagemPrincipal = imagens[0] || '/img/logo-padrao.svg';

  const miniaturas = imagens.map((url, i) => `
    <img src="${url}" class="${i === 0 ? 'ativa' : ''}" onclick="trocarImagemPrincipal('${url}')">
  `).join('');

  const tamanhos = Object.entries(produtoAtual.sizes || {});
  const semNumeracao = tamanhos.length === 0;

  // Peças como bolsas e acessórios não têm numeração: liberamos a compra direto,
  // sem exigir a escolha de um tamanho que nem existe para elas.
  if (semNumeracao) {
    tamanhoSelecionado = 'Único';
  }

  // Sem estoque em nenhum tamanho (ex.: última peça reservada): não dá para comprar
  const semEstoque = tamanhos.length > 0 && tamanhos.every(([, qtd]) => Number(qtd) <= 0);
  const compraBloqueada = produtoVendido || semEstoque;

  // Tamanho zerado fica ofuscado e não pode ser clicado; os demais continuam livres
  const botoesTamanho = tamanhos.length ? tamanhos.map(([tam, qtd]) => {
    const esgotado = Number(qtd) <= 0 || produtoVendido;
    return `
    <button class="tamanho-btn ${esgotado ? 'tamanho-esgotado' : ''}" data-tamanho="${tam}" data-qtd="${qtd}" ${esgotado ? 'disabled aria-disabled="true" title="Tamanho esgotado"' : ''}>
      ${tam}
    </button>
  `;
  }).join('') : '';

  container.innerHTML = `
    <div class="produto-detalhe">
      <div>
        <div class="galeria-principal ${produtoVendido ? 'galeria-principal--vendida' : ''}">
          <img id="imgPrincipal" class="imagem-produto" src="${imagemPrincipal}">
          ${produtoVendido ? '<span class="selo-vendida selo-vendida-detalhe" aria-label="VENDIDO">VENDIDO</span>' : ''}
        </div>
        <div class="galeria-miniaturas">${miniaturas}</div>
      </div>
      <div>
        <div class="produto-categoria">${produtoAtual.category || ''}</div>
        <h1 class="produto-titulo">${produtoAtual.name}</h1>
        <div id="areaPreco"></div>
        <p class="produto-descricao">${produtoAtual.description || 'Sem descrição.'}</p>

        ${semNumeracao ? `
        <p class="aviso-sem-numeracao">Peça sem numeração — pronta para adicionar ao carrinho.</p>
        ` : `
        <div class="tamanhos-titulo">Tamanho disponível</div>
        <div class="grade-tamanhos" id="grupoTamanhos">${botoesTamanho}</div>
        `}

        <div class="acoes-produto">
          <button class="btn btn-primario" id="btnAdicionarCarrinho" ${compraBloqueada ? 'disabled' : ''}>${produtoVendido ? 'Peça vendida' : semEstoque ? 'Sem estoque' : `${ICONES.carrinho} Adicionar ao carrinho`}</button>
          <button class="btn ${ehFavorito ? 'btn-primario' : 'btn-secundario'}" id="btnFavoritar">
            ${ICONES.coracao} ${ehFavorito ? 'Nos favoritos' : 'Favoritar'}
          </button>
        </div>
      </div>
    </div>

    <section id="secaoRelacionados" class="secao-relacionados" style="display:none;">
      <h2 class="titulo-secao">Você também pode gostar</h2>
      <p class="subtitulo-secao">Outras peças que temos por aqui 🧡</p>
      <div id="gradeRelacionados" class="grade-produtos"></div>
    </section>
  `;

  renderizarPreco();
  ativarZoomComMouse();
  carregarProdutosRelacionados(produtoAtual.id);

  document.querySelectorAll('.tamanho-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.disabled) return;
      document.querySelectorAll('.tamanho-btn').forEach(b => b.classList.remove('selecionado'));
      btn.classList.add('selecionado');
      tamanhoSelecionado = btn.dataset.tamanho;
    });
  });

  document.getElementById('btnAdicionarCarrinho').addEventListener('click', async () => {
    if (compraBloqueada) return;
    if (!usuarioAtual) { window.location.href = '/login.html'; return; }
    if (!tamanhoSelecionado) { mostrarNotificacao('Selecione um tamanho disponível antes de continuar.', 'erro'); return; }
    try {
      await apiFetch('/api/carrinho', {
        method: 'POST',
        body: JSON.stringify({ productId: produtoAtual.id, size: tamanhoSelecionado, quantity: 1 })
      });
      mostrarNotificacao('Peça adicionada ao carrinho! 🧡');
      atualizarBadgesContagem();
    } catch (e) {
      mostrarNotificacao(e.message, 'erro');
    }
  });

  document.getElementById('btnFavoritar').addEventListener('click', async (e) => {
    if (!usuarioAtual) { window.location.href = '/login.html'; return; }
    const btn = e.currentTarget;
    const ativo = btn.classList.contains('btn-primario');
    try {
      if (ativo) {
        await apiFetch(`/api/favoritos/${produtoAtual.id}`, { method: 'DELETE' });
        btn.classList.replace('btn-primario', 'btn-secundario');
        btn.innerHTML = `${ICONES.coracao} Favoritar`;
      } else {
        await apiFetch(`/api/favoritos/${produtoAtual.id}`, { method: 'POST' });
        btn.classList.replace('btn-secundario', 'btn-primario');
        btn.innerHTML = `${ICONES.coracao} Nos favoritos`;
      }
      atualizarBadgesContagem();
    } catch (err) { mostrarNotificacao(err.message, 'erro'); }
  });
}

iniciarProduto();

