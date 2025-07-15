// public/js/register.js

document.addEventListener('DOMContentLoaded', () => {
    const registerForm = document.getElementById('registerForm');
    const messageP = document.getElementById('message');

    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const password = document.getElementById('password').value;
        const confirmPassword = document.getElementById('confirmPassword').value;

        if (password !== confirmPassword) {
            messageP.textContent = 'As senhas não coincidem.';
            messageP.style.display = 'block';
            return;
        }

        const payload = {
            nome: document.getElementById('name').value,
            email: document.getElementById('email').value,
            senha: password,
            companyId: document.getElementById('companyId').value,
            pinCadastro: document.getElementById('pinCadastro').value
        };

        messageP.textContent = 'Registrando...';
        messageP.style.color = 'gray';
        messageP.style.display = 'block';

        try {
            const response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const result = await response.json();

            if (response.ok) {
                messageP.textContent = 'Registro realizado com sucesso! Redirecionando para o login...';
                messageP.style.color = 'green';
                setTimeout(() => {
                    window.location.href = '/'; // Redireciona para a página de login
                }, 2000);
            } else {
                messageP.textContent = `Erro: ${result.message}`;
                messageP.style.color = 'red';
            }
        } catch (error) {
            messageP.textContent = 'Erro de conexão. Tente novamente.';
            messageP.style.color = 'red';
        }
    });
});