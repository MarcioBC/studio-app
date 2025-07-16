// routes/authRoutes.js

const express = require('express');
const router = express.Router();
const User = require('../models/User.js');
const Company = require('../models/Company.js'); // Precisamos do modelo da Empresa
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// ROTA DE REGISTRO SEGURA (VALIDA O PIN DA EMPRESA)
router.post('/register', async (req, res) => {
    // Agora pedimos o nome, email, senha e o PIN
    const { nome, email, senha, pinCadastro } = req.body;

    try {
        // 1. Encontra a empresa que possui o PIN fornecido
        const company = await Company.findOne({ pinCadastro: pinCadastro });
        if (!company) {
            return res.status(403).json({ message: 'PIN de Cadastro inválido ou não encontrado.' });
        }

        // 2. Verifica se o e-mail do usuário já existe no sistema
        const userExists = await User.findOne({ email });
        if (userExists) {
            return res.status(409).json({ message: 'Este e-mail já está em uso.' });
        }

        // 3. Se tudo estiver correto, cria o novo usuário
        const user = await User.create({
            nome,
            email,
            senha,
            companyId: company._id, // Associa o usuário à empresa encontrada
            role: 'profissional' // Define novos usuários com a role padrão
        });

        res.status(201).json({ message: 'Usuário registrado com sucesso!' });

    } catch (error) {
        console.error("Erro no registro de usuário:", error);
        res.status(500).json({ message: 'Erro interno do servidor.' });
    }
});

// ROTA DE LOGIN (permanece a mesma)
router.post('/login', async (req, res) => {
    try {
        const { email, senha } = req.body;
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({ message: 'E-mail ou senha inválidos.' });
        }
        const isMatch = await bcrypt.compare(senha, user.senha);
        if (!isMatch) {
            return res.status(401).json({ message: 'E-mail ou senha inválidos.' });
        }

        const tokenPayload = {
            id: user._id,
            nome: user.nome,
            companyId: user.companyId
        };

        const token = jwt.sign(tokenPayload, process.env.JWT_SECRET, { expiresIn: '1d' });
        res.cookie('token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production' });
        res.status(200).json({ message: 'Login realizado com sucesso!' });
    } catch (error) {
        res.status(500).json({ message: 'Erro no servidor.' });
    }
});

// Rota de Logout
router.get('/logout', (req, res) => {
    res.cookie('token', '', { httpOnly: true, expires: new Date(0) });
    res.redirect('/index.html');
});

module.exports = router;