// routes/userRoutes.js

const express = require('express');
const router = express.Router();
const User = require('../models/User.js');

// Rota GET: Lista todos os usuários (sem a senha)
router.get('/', async (req, res) => {
    try {
        const users = await User.find({}).select('-senha');
        res.status(200).json(users);
    } catch (error) {
        res.status(500).json({ message: 'Erro ao buscar usuários.' });
    }
});

// Rota GET /:id - BUSCA UM ÚNICO USUÁRIO PARA EDIÇÃO
router.get('/:id', async (req, res) => {
    try {
        const user = await User.findById(req.params.id).select('-senha');
        if (!user) {
            return res.status(404).json({ message: 'Usuário não encontrado.' });
        }
        res.status(200).json(user);
    } catch (error) {
        res.status(500).json({ message: 'Erro ao buscar usuário.' });
    }
});

// Rota POST: Adiciona um novo usuário
router.post('/', async (req, res) => {
    const { nome, email, senha } = req.body;
    try {
        const userExists = await User.findOne({ email });
        if (userExists) {
            return res.status(400).json({ message: 'Este e-mail já está em uso.' });
        }
        const user = await User.create({ nome, email, senha });
        res.status(201).json({ message: 'Usuário criado com sucesso!', data: user });
    } catch (error) {
        res.status(500).json({ message: 'Erro ao criar usuário.', error: error.message });
    }
});

// Rota PUT: Atualiza um usuário
router.put('/:id', async (req, res) => {
    try {
        const { nome, email } = req.body;
        const updatedUser = await User.findByIdAndUpdate(req.params.id, { nome, email }, { new: true, runValidators: true }).select('-senha');
        if (!updatedUser) {
            return res.status(404).json({ message: 'Usuário não encontrado.' });
        }
        res.status(200).json({ message: 'Usuário atualizado com sucesso!', data: updatedUser });
    } catch (error) {
        res.status(500).json({ message: 'Erro ao atualizar usuário.' });
    }
});

// Rota DELETE: Exclui um usuário
router.delete('/:id', async (req, res) => {
    try {
        const user = await User.findByIdAndDelete(req.params.id);
        if (!user) {
            return res.status(404).json({ message: 'Usuário não encontrado.' });
        }
        res.status(200).json({ message: 'Usuário excluído com sucesso!' });
    } catch (error) {
        res.status(500).json({ message: 'Erro ao excluir usuário.' });
    }
});

module.exports = router;