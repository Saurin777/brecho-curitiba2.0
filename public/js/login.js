async function iniciarLogin() {
  await Promise.all([carregarUsuario(), carregarConfiguracoes()]);
  montarRodape();

  const logoLogin = document.getElementById('logoLogin');
  if (logoLogin && configuracoesSite) {
    logoLogin.src = configuracoesSite.logoUrl || '/img/logo-padrao.svg';
    logoLogin.alt = `Logo ${configuracoesSite.nomeLoja || 'Brechó Curitiba'}`;
  }

  if (usuarioAtual) {
    window.location.href = '/index.html';
    return;
  }

  const form = document.getElementById('formLogin');
  const erroEl = document.getElementById('mensagemErro');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    erroEl.style.display = 'none';

    const contato = document.getElementById('contato').value.trim();
    const password = document.getElementById('password').value;

    try {
      await apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ contato, password })
      });
      window.location.href = '/index.html';
    } catch (err) {
      erroEl.textContent = err.message;
      erroEl.style.display = 'block';
    }
  });
}

iniciarLogin();
