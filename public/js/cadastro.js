async function iniciarCadastro() {
  await Promise.all([carregarUsuario(), carregarConfiguracoes()]);
  montarRodape();

  const logoCadastro = document.getElementById('logoCadastro');
  if (logoCadastro && configuracoesSite) {
    logoCadastro.src = configuracoesSite.logoUrl || '/img/logo-padrao.svg';
    logoCadastro.alt = `Logo ${configuracoesSite.nomeLoja || 'Brechó Curitiba'}`;
  }

  if (usuarioAtual) {
    window.location.href = '/index.html';
    return;
  }

  const form = document.getElementById('formCadastro');
  const erroEl = document.getElementById('mensagemErro');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    erroEl.style.display = 'none';

    const name = document.getElementById('name').value.trim();
    const contato = document.getElementById('contato').value.trim();
    const password = document.getElementById('password').value;

    try {
      await apiFetch('/api/auth/registro', {
        method: 'POST',
        body: JSON.stringify({ name, contato, password })
      });
      window.location.href = '/index.html';
    } catch (err) {
      erroEl.textContent = err.message;
      erroEl.style.display = 'block';
    }
  });
}

iniciarCadastro();
