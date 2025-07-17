// public/js/main.js

// Função para formatar valores como moeda (já deve existir, mas mantendo aqui por clareza)
const formatAsCurrency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

// Função de logout global
function logoutUser() {
    console.log("main.js: logoutUser() chamado. Limpando localStorage e redirecionando.");
    localStorage.removeItem('token');
    localStorage.removeItem('companyName');
    localStorage.removeItem('userEmail'); // Limpa também o email do usuário se estiver armazenado
    window.location.href = '/index.html'; // Redireciona para a página de login
}

// Lógica de inatividade (já deve estar em cada HTML, mas a função logoutUser é global)
// As chamadas a startInactivityTimer e resetInactivityTimer devem estar nos DOMContentLoaded de cada página.

document.addEventListener('DOMContentLoaded', () => {
    // Esta parte é para páginas que não são o login, para verificar o token ao carregar.
    // Se não houver token, redireciona para o login.
    const token = localStorage.getItem('token');
    if (!token && window.location.pathname !== '/index.html') {
        console.warn("main.js: Token não encontrado no localStorage. Redirecionando para login.");
        logoutUser();
        return; // Importante para parar a execução
    }

    // Lógica para o formulário de login (apenas para index.html)
    const loginForm = document.getElementById('loginForm');
    const loginStatus = document.getElementById('loginStatus');

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;

            console.log("main.js: Tentando login para:", email); // DEBUG

            try {
                const response = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });

                const data = await response.json();
                console.log("main.js: Resposta do login:", data); // DEBUG

                if (response.ok) {
                    localStorage.setItem('token', data.token);
                    localStorage.setItem('companyName', data.companyName);
                    localStorage.setItem('userEmail', email); // Armazena o email do usuário
                    console.log("main.js: Login bem-sucedido. Token e companyName armazenados."); // DEBUG
                    loginStatus.textContent = 'Login bem-sucedido! Redirecionando...';
                    loginStatus.className = 'status-message status-success';

                    // Garante que o timer de inatividade seja reiniciado após um login bem-sucedido
                    // Isso é crucial para evitar logout imediato se o timer estiver rodando
                    if (typeof resetInactivityTimer === 'function') {
                        resetInactivityTimer(); // Chama a função global de reset do timer
                        console.log("main.js: Timer de inatividade resetado após login."); // DEBUG
                    }

                    setTimeout(() => {
                        window.location.href = '/dashboard.html';
                    }, 500); // Pequeno atraso para a mensagem ser visível
                } else {
                    loginStatus.textContent = data.message || 'Erro no login.';
                    loginStatus.className = 'status-message status-error';
                    console.error("main.js: Erro no login:", data.message); // DEBUG
                }
            } catch (error) {
                loginStatus.textContent = 'Erro de conexão. Tente novamente.';
                loginStatus.className = 'status-message status-error';
                console.error("main.js: Erro de conexão durante o login:", error); // DEBUG
            }
        });
    }

    // Lógica para o botão de logout (em todas as páginas)
    const logoutLink = document.querySelector('a[href="/api/auth/logout"]');
    if (logoutLink) {
        logoutLink.addEventListener('click', async (e) => {
            e.preventDefault();
            console.log("main.js: Link de Sair clicado."); // DEBUG
            // Não é necessário chamar a API de logout no backend,
            // pois o logout no frontend é apenas limpar o token e redirecionar.
            logoutUser();
        });
    }
});

// A função 'logoutUser' e 'formatAsCurrency' são globais e podem ser usadas por outros scripts.
// As funções 'startInactivityTimer' e 'resetInactivityTimer' também devem ser globais
// para serem chamadas do DOMContentLoaded de cada página HTML.
// Certifique-se de que elas estejam definidas antes de serem chamadas.
// Exemplo de como elas devem ser definidas (se ainda não estiverem):

// let timeoutId; // Variável para armazenar o ID do timer

// function startInactivityTimer() {
//     clearTimeout(timeoutId);
//     timeoutId = setTimeout(logoutUser, INACTIVITY_TIME);
//     console.log("main.js: Timer de inatividade iniciado/reiniciado."); // DEBUG
// }

// function resetInactivityTimer() {
//     if (localStorage.getItem('token')) { // Só reseta se houver um token (usuário logado)
//         startInactivityTimer();
//     } else {
//         console.log("main.js: Não resetando timer: usuário não logado."); // DEBUG
//     }
// }

// A constante INACTIVITY_TIME deve ser definida em cada arquivo HTML que a utiliza,
// ou globalmente se você mover a lógica do timer para main.js.
// Por enquanto, é melhor mantê-la em cada HTML com a lógica do timer.