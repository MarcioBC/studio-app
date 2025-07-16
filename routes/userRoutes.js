// routes/userRoutes.js

const express = require('express');
const router = express.Router();
const User = require('../models/User.js'); // Certifique-se de que o User.js tem o companyId
const Company = require('../models/Company.js'); // Pode não ser estritamente necessário aqui, mas não faz mal estar.

// Rota GET: Lista todos os usuários DA EMPRESA LOGADA (sem a senha)
router.get('/', async (req, res) => {
    try {
        // Verifica se o usuário logado tem companyId (middleware de autenticação deve adicionar req.user)
        if (!req.user || !req.user.companyId) {
            return res.status(401).json({ message: 'Usuário não autenticado ou sem ID de empresa.' });
        }

        // Filtra os usuários APENAS pela companyId do usuário logado
        const users = await User.find({ companyId: req.user.companyId }).select('-senha');
        res.status(200).json(users);
    } catch (error) {
        console.error("Erro ao buscar usuários:", error);
        res.status(500).json({ message: 'Erro ao buscar usuários.' });
    }
});

// Rota GET /:id - BUSCA UM ÚNICO USUÁRIO PARA EDIÇÃO DA EMPRESA LOGADA
router.get('/:id', async (req, res) => {
    try {
        // Verifica se o usuário logado tem companyId
        if (!req.user || !req.user.companyId) {
            return res.status(401).json({ message: 'Usuário não autenticado ou sem ID de empresa.' });
        }
        // Busca o usuário APENAS se ele pertence à empresa logada
        const user = await User.findOne({ _id: req.params.id, companyId: req.user.companyId }).select('-senha');
        if (!user) {
            // Pode ser 404 (não existe) ou 404/403 (existe, mas não pertence à empresa do usuário logado)
            return res.status(404).json({ message: 'Usuário não encontrado ou não pertence à sua empresa.' });
        }
        res.status(200).json(user);
    } catch (error) {
        console.error("Erro ao buscar usuário por ID:", error);
        res.status(500).json({ message: 'Erro ao buscar usuário.' });
    }
});

// Rota POST: Adiciona um novo usuário (usada na tela de Gerenciar Usuários)
// NOTA: A rota de registro principal está em authRoutes.js com validação de PIN.
// Esta rota é para adicionar usuários *dentro* da empresa já logada (ex: por um admin)
router.post('/', async (req, res) => {
    const { nome, email, senha } = req.body;
    try {
        // Verifica se o usuário logado tem companyId
        if (!req.user || !req.user.companyId) {
            return res.status(401).json({ message: 'Usuário não autenticado ou sem ID de empresa.' });
        }

        // Verificação de e-mail existente APENAS DENTRO DA MESMA EMPRESA
        const userExists = await User.findOne({ email, companyId: req.user.companyId });
        if (userExists) {
            return res.status(400).json({ message: 'Este e-mail já está em uso para esta empresa.' });
        }
        
        // Adiciona o companyId ao criar o usuário
        const user = await User.create({ nome, email, senha, companyId: req.user.companyId });
        res.status(201).json({ message: 'Usuário criado com sucesso!', data: user });
    } catch (error) {
        console.error("Erro ao criar usuário:", error);
        res.status(500).json({ message: 'Erro ao criar usuário.', error: error.message });
    }
});

// Rota PUT: Atualiza um usuário DA EMPRESA LOGADA
router.put('/:id', async (req, res) => {
    try {
        if (!req.user || !req.user.companyId) {
            return res.status(401).json({ message: 'Usuário não autenticado ou sem ID de empresa.' });
        }
        const { nome, email } = req.body;
        // Atualiza o usuário APENAS se ele pertence à empresa logada
        const updatedUser = await User.findOneAndUpdate(
            { _id: req.params.id, companyId: req.user.companyId }, // Filtro de _id E companyId
            { nome, email },
            { new: true, runValidators: true }
        ).select('-senha');
        if (!updatedUser) {
            // Se não encontrar, pode ser 404 (não existe) ou 404/403 (existe, mas não pertence à empresa do usuário logado)
            return res.status(404).json({ message: 'Usuário não encontrado ou não pertence à sua empresa.' });
        }
        res.status(200).json({ message: 'Usuário atualizado com sucesso!', data: updatedUser });
    } catch (error) {
        console.error("Erro ao atualizar usuário:", error);
        res.status(500).json({ message: 'Erro ao atualizar usuário.' });
    }
});

// Rota DELETE: Exclui um usuário DA EMPRESA LOGADA
router.delete('/:id', async (req, res) => {
    try {
        if (!req.user || !req.user.companyId) {
            return res.status(401).json({ message: 'Usuário não autenticado ou sem ID de empresa.' });
        }
        // Exclui o usuário APENAS se ele pertence à empresa logada
        const user = await User.findOneAndDelete({ _id: req.params.id, companyId: req.user.companyId });
        if (!user) {
            // Se não encontrar, pode ser 404 (não existe) ou 404/403 (existe, mas não pertence à empresa do usuário logado)
            return res.status(404).json({ message: 'Usuário não encontrado ou não pertence à sua empresa.' });
        }
        res.status(200).json({ message: 'Usuário excluído com sucesso!' });
    } catch (error) {
        console.error("Erro ao excluir usuário:", error);
        res.status(500).json({ message: 'Erro ao excluir usuário.' });
    }
});

module.exports = router;