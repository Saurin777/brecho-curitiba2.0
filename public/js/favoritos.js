function renderizarCardFavorito(produto) {
  const imagem = produto.images && produto.images[0]
    ? `<img src="${produto.images[0]}" alt="${produto.name}">`
    : `<div class="sem-imagem">Sem foto ainda</div>`;

  // o selo de destaque acompanha a peça em qualquer lista, inclusive nos favoritos
  const ehDestaque = !!produto.featured;
  const selo = ehDestaque
    ? `<span class="selo-destaque">${ICONES.estrela || '★'} Destaque</span>`
    : '';

  return `
    <div class="card-produto ${ehDestaque ? 'card-produto--destaque' : ''}" data-id="${produto.id}">
      <div class="imagem-wrap">
        ${imagem}
        ${selo}
        <button class="btn-favorito ativo" data-id="${produto.id}" title="Remover dos favoritos">
          ${ICONES.coracao}
        </button>
      </div>
      <div class="info">
        <div class="categoria">${produto.category || ''}</div>
        <div class="nome">${produto.name}</div>
        <div id="precoCard-${produto.id}">${precoComCronometroCard(produto)}</div>
        <a href="/produto.html?id=${produto.id}" class="btn btn-primario btn-bloco">Ver detalhes</a>
      </div>
    </div>
  `;
}

async function carregarFavoritos() {
  const lista = document.getElementById('listaFavoritos');
  const vazio = document.getElementById('estadoVazio');

  let produtos = [];
  try {
    produtos = await apiFetch('/api/favoritos');
  } catch (e) {
    produtos = [];
  }

  if (produtos.length === 0) {
    lista.innerHTML = '';
    vazio.style.display = 'block';
    return;
  }

  vazio.style.display = 'none';
  lista.innerHTML = produtos.map(renderizarCardFavorito).join('');

  document.querySelectorAll('.card-produto .btn-bloco').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      window.location.href = link.getAttribute('href');
    });
  });

  document.querySelectorAll('.btn-favorito').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      const id = btn.dataset.id;
      try {
        await apiFetch(`/api/favoritos/${id}`, { method: 'DELETE' });
        await carregarFavoritos();
        atualizarBadgesContagem();
      } catch (err) {
        mostrarNotificacao(err.message, 'erro');
      }
    });
  });
}

async function iniciarFavoritos() {
  await montarCabecalho();
  montarRodape();
  if (!exigirLoginOuRedirecionar()) return;
  await carregarFavoritos();
}

iniciarFavoritos();
