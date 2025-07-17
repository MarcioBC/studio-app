// public/js/main.js

document.addEventListener('DOMContentLoaded', () => {
    const menuToggle = document.getElementById('menuToggle');
    const sidebar = document.getElementById('sidebar');

    if (menuToggle && sidebar) {
        menuToggle.addEventListener('click', () => {
            sidebar.classList.toggle('active');
        });
    }
    // public/js/main.js

document.addEventListener('DOMContentLoaded', () => {
    const menuToggle = document.getElementById('menuToggle');
    const sidebar = document.getElementById('sidebar');

    if (menuToggle && sidebar) {
        menuToggle.addEventListener('click', () => {
            sidebar.classList.toggle('active');
        });
    }

    // --- NOVA FUNÇÃO: Logout Automático ---
    function logoutUser() {
        console.log("Inatividade detectada ou logout manual. Redirecionando...");
        // Limpa todos os dados de autenticação do localStorage
        localStorage.removeItem('token');
        localStorage.removeItem('userRole');
        localStorage.removeItem('companyId');
        localStorage.removeItem('companyName');

        // Redireciona para a página de login
        window.location.href = '/index.html';
    }

    // Adiciona um listener para o botão de logout no sidebar (se existir)
    const logoutButton = document.querySelector('a[href="/api/auth/logout"]');
    if (logoutButton) {
        logoutButton.addEventListener('click', (e) => {
            e.preventDefault(); // Previne o comportamento padrão do link
            logoutUser(); // Chama a função de logout
        });
    }
    // --- FIM DA NOVA FUNÇÃO ---

});
});