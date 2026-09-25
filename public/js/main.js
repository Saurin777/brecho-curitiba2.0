// main.js - vitrine da página inicial com busca e filtro por categorias

let todosProdutos = [];
let produtosDestaque = [];
let favoritosIds = [];

let termoBusca = '';
let categoriasSelecionadas = new Set();

function renderizarCardProduto(produto) {
  const imagem = produto.images && produto.images[0]
    ? `<img class="imagem-produto" src="${produto.images[0]}" alt="${produto.name}">`
    : `<div class="sem-imagem">Sem foto ainda</div>`;

  const ehFavorito = favoritosIds.includes(produto.id);
  // o selo de destaque acompanha a peça em qualquer lista (busca, "todas as peças" etc.),
  // pois depende só do produto ser destaque (produto.featured), não da seção onde aparece
  const ehDestaque = !!produto.featured;
  const selo = ehDestaque
    ? `<span class="selo-destaque">${ICONES.estrela || '★'} Destaque</span>`
    : '';

  const seloVendida = produto.vendida
    ? `<span class="selo-vendida" aria-label="VENDIDO">VENDIDO</span>`
    : '';

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
        <div class="nome">${produto.name}</div>
        ${produto.vendida ? '' : `<div id="precoCard-${produto.id}">${precoComCronometroCard(produto)}</div>`}
        ${produto.vendida ? '' : `<a href="/produto.html?id=${produto.id}" class="btn btn-primario btn-bloco">Ver detalhes</a>`}
      </div>
    </div>
  `;
}

function ativarAcoesCard(container) {
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
          favoritosIds = favoritosIds.filter(f => f !== id);
        } else {
          await apiFetch(`/api/favoritos/${id}`, { method: 'POST' });
          favoritosIds.push(id);
        }
        document.querySelectorAll(`.btn-favorito[data-id="${id}"]`).forEach(b => b.classList.toggle('ativo', !ativo));
        atualizarBadgesContagem();
      } catch (err) {
        mostrarNotificacao(err.message, 'erro');
      }
    });
  });
}

function renderizarLista(produtos, listaId, vazioId, mensagemVazio) {
  const lista = document.getElementById(listaId);
  const vazio = document.getElementById(vazioId);
  if (!lista) return;

  if (produtos.length === 0) {
    lista.innerHTML = '';
    if (mensagemVazio) vazio.textContent = mensagemVazio;
    vazio.style.display = 'block';
    return;
  }
  vazio.style.display = 'none';
  lista.innerHTML = produtos.map(p => renderizarCardProduto(p)).join('');
  ativarAcoesCard(lista);
}

// ---------- Busca e filtros ----------

function normalizar(texto) {
  return (texto || '')
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // tira acentos: "calça" acha "calca"
    .trim();
}

function produtoCombina(produto) {
  // filtro de categoria (marcar 1, 2, 3... categorias)
  if (categoriasSelecionadas.size > 0) {
    const cat = normalizar(produto.category);
    if (!categoriasSelecionadas.has(cat)) return false;
  }

  // busca por texto: nome, categoria ou descrição
  if (termoBusca) {
    const palavras = normalizar(termoBusca).split(/\s+/).filter(Boolean);
    const alvo = `${normalizar(produto.name)} ${normalizar(produto.category)} ${normalizar(produto.description)}`;
    if (!palavras.every(p => alvo.includes(p))) return false;
  }

  return true;
}

function filtrosAtivos() {
  return categoriasSelecionadas.size > 0 || termoBusca.length > 0;
}

function montarListaCategorias() {
  const el = document.getElementById('listaCategorias');
  if (!el) return;

  // monta a lista a partir das categorias que realmente existem nos produtos
  const mapa = new Map(); // chave normalizada -> { rotulo, total }
  todosProdutos.forEach(p => {
    const rotulo = (p.category || '').trim();
    if (!rotulo) return;
    const chave = normalizar(rotulo);
    if (!mapa.has(chave)) mapa.set(chave, { rotulo, total: 0 });
    mapa.get(chave).total++;
  });

  if (mapa.size === 0) {
    el.innerHTML = `<p class="aviso-vazio-filtro">Nenhuma categoria cadastrada ainda.</p>`;
    return;
  }

  const itens = [...mapa.entries()].sort((a, b) => a[1].rotulo.localeCompare(b[1].rotulo, 'pt-BR'));

  el.innerHTML = itens.map(([chave, info]) => `
    <label class="item-categoria">
      <input type="checkbox" value="${chave}" ${categoriasSelecionadas.has(chave) ? 'checked' : ''}>
      <span class="marcador"></span>
      <span class="rotulo-categoria">${info.rotulo}</span>
      <span class="qtd-categoria">${info.total}</span>
    </label>
  `).join('');

  el.querySelectorAll('input[type="checkbox"]').forEach(chk => {
    chk.addEventListener('change', () => {
      if (chk.checked) categoriasSelecionadas.add(chk.value);
      else categoriasSelecionadas.delete(chk.value);
      aplicarFiltros();
    });
  });
}

function aplicarFiltros() {
  const destaquesFiltrados = produtosDestaque.filter(produtoCombina);
  const todosFiltrados = todosProdutos.filter(produtoCombina);

  const secaoDestaques = document.getElementById('secaoDestaques');
  const tituloTodos = document.getElementById('tituloTodos');
  const subtituloTodos = document.getElementById('subtituloTodos');
  const ativo = filtrosAtivos();

  // com filtro ativo a gente esconde os destaques e mostra só o resultado da busca
  if (secaoDestaques) secaoDestaques.style.display = ativo ? 'none' : '';
  if (tituloTodos) {
    tituloTodos.textContent = ativo ? 'Resultado da busca' : 'Todas as peças';
    tituloTodos.style.marginTop = ativo ? '0' : '48px';
  }
  if (subtituloTodos) {
    subtituloTodos.textContent = ativo
      ? `${todosFiltrados.length} ${todosFiltrados.length === 1 ? 'peça encontrada' : 'peças encontradas'}`
      : 'Dá uma olhada em tudo que temos por aqui 🧡';
  }

  if (!ativo) {
    renderizarLista(destaquesFiltrados, 'listaProdutos', 'estadoVazioDestaque', null);
    configurarCarrosselDestaques();
  }

  renderizarLista(
    todosFiltrados,
    'listaTodosProdutos',
    'estadoVazioTodos',
    ativo ? 'Nenhuma peça encontrada com esses filtros. Tente outra busca 🧡' : 'Ainda não temos peças cadastradas.'
  );

  atualizarResumoFiltros(todosFiltrados.length);
}

// ---------- Carrossel dos destaques (setas para o lado) ----------

let carrosselDestaquesPronto = false;

function configurarCarrosselDestaques() {
  const trilha = document.getElementById('listaProdutos');
  const btnEsq = document.getElementById('setaDestaqueEsq');
  const btnDir = document.getElementById('setaDestaqueDir');
  if (!trilha || !btnEsq || !btnDir) return;

  function atualizarSetas() {
    const maximo = trilha.scrollWidth - trilha.clientWidth - 2;
    btnEsq.classList.toggle('seta-oculta', trilha.scrollLeft <= 4);
    btnDir.classList.toggle('seta-oculta', maximo <= 0 || trilha.scrollLeft >= maximo);
  }

  if (!carrosselDestaquesPronto) {
    btnEsq.addEventListener('click', () => {
      trilha.scrollBy({ left: -trilha.clientWidth * 0.85, behavior: 'smooth' });
    });
    btnDir.addEventListener('click', () => {
      trilha.scrollBy({ left: trilha.clientWidth * 0.85, behavior: 'smooth' });
    });
    trilha.addEventListener('scroll', atualizarSetas);
    window.addEventListener('resize', atualizarSetas);
    carrosselDestaquesPronto = true;
  }

  // dá um tempinho pro layout assentar antes de medir a largura
  setTimeout(atualizarSetas, 50);
}

function atualizarResumoFiltros(quantidade) {
  const contagem = document.getElementById('contagemResultados');
  const badge = document.getElementById('badgeFiltros');
  const btnLimparBusca = document.getElementById('btnLimparBusca');

  if (contagem) {
    contagem.textContent = filtrosAtivos()
      ? `${quantidade} de ${todosProdutos.length} peças`
      : `${todosProdutos.length} ${todosProdutos.length === 1 ? 'peça disponível' : 'peças disponíveis'}`;
  }

  if (badge) {
    const qtdFiltros = categoriasSelecionadas.size + (termoBusca ? 1 : 0);
    badge.textContent = qtdFiltros;
    badge.style.display = qtdFiltros > 0 ? 'inline-flex' : 'none';
  }

  if (btnLimparBusca) btnLimparBusca.style.display = termoBusca ? 'flex' : 'none';
}

function ativarControlesFiltro() {
  const campoBusca = document.getElementById('campoBusca');
  const btnLimparBusca = document.getElementById('btnLimparBusca');
  const btnLimparFiltros = document.getElementById('btnLimparFiltros');
  const btnAbrirFiltros = document.getElementById('btnAbrirFiltros');
  const painel = document.getElementById('painelLateral');

  if (campoBusca) {
    let timer = null;
    campoBusca.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        termoBusca = campoBusca.value.trim();
        aplicarFiltros();
      }, 180);
    });
    campoBusca.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { campoBusca.value = ''; termoBusca = ''; aplicarFiltros(); }
    });
  }

  if (btnLimparBusca) {
    btnLimparBusca.addEventListener('click', () => {
      campoBusca.value = '';
      termoBusca = '';
      campoBusca.focus();
      aplicarFiltros();
    });
  }

  if (btnLimparFiltros) {
    btnLimparFiltros.addEventListener('click', () => {
      categoriasSelecionadas.clear();
      termoBusca = '';
      if (campoBusca) campoBusca.value = '';
      document.querySelectorAll('#listaCategorias input[type="checkbox"]').forEach(c => { c.checked = false; });
      aplicarFiltros();
    });
  }

  // no celular o painel abre/fecha
  if (btnAbrirFiltros && painel) {
    btnAbrirFiltros.addEventListener('click', () => {
      painel.classList.toggle('aberto');
      btnAbrirFiltros.classList.toggle('ativo');
    });
  }
}

async function iniciarFeed() {
  await montarCabecalho();
  montarRodape();

  const [destaques, todos] = await Promise.all([
    apiFetch('/api/produtos?featured=1'),
    apiFetch('/api/produtos')
  ]);

  produtosDestaque = destaques || [];
  todosProdutos = todos || [];

  if (usuarioAtual) {
    try {
      const favoritos = await apiFetch('/api/favoritos');
      favoritosIds = favoritos.map(f => f.id);
    } catch (e) { /* ignora */ }
  }

  // aceita /index.html?busca=vestido vindo de outras páginas
  const termoUrl = new URLSearchParams(window.location.search).get('busca');
  if (termoUrl) {
    termoBusca = termoUrl.trim();
    const campo = document.getElementById('campoBusca');
    if (campo) campo.value = termoBusca;
  }

  montarListaCategorias();
  ativarControlesFiltro();
  aplicarFiltros();
  // A vitrine NÃO fica sendo recarregada em intervalos curtos.
  // Isso evita o "pisca-pisca" no celular. A atualização automática em tempo
  // real fica reservada ao status da logo (status.js).
}

iniciarFeed();
