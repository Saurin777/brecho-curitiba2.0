let produtoAtual = null;
let tamanhoSelecionado = null;
let timerPromocao = null;

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

  const botoesTamanho = tamanhos.length ? tamanhos.map(([tam, qtd]) => `
    <button class="tamanho-btn" data-tamanho="${tam}" data-qtd="${qtd}" ${qtd <= 0 || produtoVendido ? 'disabled' : ''}>
      ${tam}
    </button>
  `).join('') : '';

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
          <button class="btn btn-primario" id="btnAdicionarCarrinho" ${produtoVendido ? 'disabled' : ''}>${produtoVendido ? 'Peça vendida' : `${ICONES.carrinho} Adicionar ao carrinho`}</button>
          <button class="btn ${ehFavorito ? 'btn-primario' : 'btn-secundario'}" id="btnFavoritar">
            ${ICONES.coracao} ${ehFavorito ? 'Nos favoritos' : 'Favoritar'}
          </button>
        </div>
      </div>
    </div>
  `;

  renderizarPreco();
  ativarZoomComMouse();

  document.querySelectorAll('.tamanho-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.disabled) return;
      document.querySelectorAll('.tamanho-btn').forEach(b => b.classList.remove('selecionado'));
      btn.classList.add('selecionado');
      tamanhoSelecionado = btn.dataset.tamanho;
    });
  });

  document.getElementById('btnAdicionarCarrinho').addEventListener('click', async () => {
    if (produtoVendido) return;
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

