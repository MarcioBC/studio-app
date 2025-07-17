// routes/authRoutes.js

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User.js');
const Company = require('../models/Company.js'); // Importe o modelo Company

// ROTA DE REGISTRO SEGURA (VALIDA O PIN DA EMPRESA)
router.post('/register', async (req, res) => {
    try {
        const { nome, email, senha, pinCadastro } = req.body;

        // 1. Verifica se o e-mail já existe no sistema (globalmente, para evitar duplicação de login)
        const userExists = await User.findOne({ email });
        if (userExists) {
            return res.status(409).json({ message: 'Este e-mail já está em uso.' });
        }

        // 2. Encontra a empresa que possui o PIN fornecido
        const company = await Company.findOne({ pinCadastro: pinCadastro });
        if (!company) {
            console.log(`Empresa não encontrada para o PIN: ${pinCadastro}`);
            return res.status(403).json({ message: 'PIN de cadastro inválido.' });
        }

        // 3. Hash da senha
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(senha, salt);

        // 4. Se tudo estiver correto, cria o novo usuário
        const user = await User.create({
            nome,
            email,
            senha: hashedPassword,
            companyId: company._id, // Associa o usuário ao ID da empresa encontrada
            role: 'profissional' // Define o papel padrão como 'profissional'
        });

        // 5. Gera o token JWT (este token será usado para o usuário recém-registrado)
        const token = jwt.sign({ id: user._id, companyId: user.companyId, role: user.role }, process.env.JWT_SECRET, {
            expiresIn: '1h',
        });

        // Retorna a resposta completa, incluindo o token e o nome da empresa
        res.status(201).json({
            message: 'Usuário registrado com sucesso!',
            token, // Retorna o token
            user: { // Retorna o objeto user completo
                id: user._id,
                nome: user.nome,
                email: user.email,
                companyId: user.companyId,
                role: user.role,
                companyName: company.name // Retorna o nome da empresa
            }
        });

    } catch (error) {
        console.error("Erro no registro:", error);
        res.status(500).json({ message: 'Erro no servidor ao registrar usuário.' });
    }
});

// ROTA DE LOGIN
router.post('/login', async (req, res) => {
    try {
        const { email, senha } = req.body;

        // 1. Verifica se o usuário existe
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ message: 'Credenciais inválidas.' });
        }

        // 2. Compara a senha fornecida com a senha hash no banco de dados
        const isMatch = await bcrypt.compare(senha, user.senha);
        if (!isMatch) {
            return res.status(400).json({ message: 'Credenciais inválidas.' });
        }

        // 3. Busca o nome da empresa usando o companyId do usuário
        const company = await Company.findById(user.companyId);
        if (!company) {
            // Isso não deveria acontecer se o registro foi bem-sucedido e o companyId existe
            return res.status(500).json({ message: 'Empresa associada ao usuário não encontrada.' });
        }

        // 4. Gera o token JWT
        const token = jwt.sign({ id: user._id, companyId: user.companyId, role: user.role }, process.env.JWT_SECRET, {
            expiresIn: '1h',
        });

        // --- AQUI ESTÁ A CHAVE: RETORNAR TODOS OS DADOS NECESSÁRIOS NO JSON ---
        res.status(200).json({
            message: 'Login bem-sucedido!',
            token, // <--- O TOKEN DEVE SER RETORNADO
            user: { // <--- O OBJETO 'user' DEVE SER RETORNADO COM TODOS OS DADOS
                id: user._id,
                nome: user.nome,
                email: user.email,
                companyId: user.companyId,
                role: user.role,
                companyName: company.name // <--- O NOME DA EMPRESA DEVE SER RETORNADO AQUI
            }
        });

    } catch (error) {
        console.error("Erro no login:", error);
        res.status(500).json({ message: 'Erro no servidor ao fazer login.' });
    }
});

module.exports = router;