// routes/companyRoutes.js

const express = require('express');
const router = express.Router();
const Company = require('../models/Company.js');
const User = require('../models/User.js');

// Rota para registrar uma nova empresa e seu primeiro usuário admin
router.post('/register', async (req, res) => {
    const { companyName, pinCadastro, nome, email, senha } = req.body;

    try {
        // Verifica se a empresa ou o e-mail já existem
        const companyExists = await Company.findOne({ pinCadastro });
        if (companyExists) {
            return res.status(409).json({ message: 'Uma empresa com este PIN já existe.' });
        }
        const userExists = await User.findOne({ email });
        if (userExists) {
            return res.status(409).json({ message: 'Este e-mail já está em uso por outro usuário.' });
        }

        // Cria a nova empresa
        const newCompany = await Company.create({
            nome: companyName,
            pinCadastro: pinCadastro
        });

        // Cria o primeiro usuário como administrador desta empresa
        const newUser = await User.create({
            nome,
            email,
            senha,
            companyId: newCompany._id, // Associa o usuário à nova empresa
            role: 'admin' // Define o primeiro usuário como admin
        });

        res.status(201).json({ message: 'Empresa e usuário administrador registrados com sucesso!' });

    } catch (error) {
        console.error("Erro no registro da empresa:", error);
        res.status(500).json({ message: 'Erro no servidor ao registrar a empresa.', error: error.message });
    }
});

module.exports = router;