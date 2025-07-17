// routes/authRoutes.js

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User.js');
const Company = require('../models/Company.js'); 

// ... (sua rota /register, que não foi incluída aqui para foco) ...

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

        // 3. Busca a empresa usando o companyId do usuário
        const company = await Company.findById(user.companyId); 

        // --- CONSOLE.LOGS DE DEPURACAO ---
        console.log("DEBUG BACKEND LOGIN: Objeto 'company' encontrado:", company); 
        // AQUI ESTÁ A MUDANÇA: Usando company._doc.name para depurar o valor
        console.log("DEBUG BACKEND LOGIN: company.name a ser enviado (com _doc):", company ? company._doc.name : "company é nulo/undefined"); 
        // --- FIM DOS CONSOLE.LOGS ---

        if (!company) {
            console.error("Erro: Empresa associada ao usuário não encontrada. companyId:", user.companyId); 
            return res.status(500).json({ message: 'Empresa associada ao usuário não encontrada.' });
        }

        // 4. Gera o token JWT
        const token = jwt.sign({ id: user._id, companyId: user.companyId, role: user.role }, process.env.JWT_SECRET, {
            expiresIn: '1h',
        });

        // 5. Retorna o token, informações do usuário e o nome da empresa
        res.status(200).json({
            message: 'Login bem-sucedido!',
            token, 
            user: { 
                id: user._id,
                nome: user.nome,
                email: user.email,
                companyId: user.companyId,
                role: user.role,
                companyName: company._doc.name // <--- CORREÇÃO CRÍTICA AQUI: Use company._doc.name
            }
        });

    } catch (error) {
        console.error("Erro no login:", error);
        res.status(500).json({ message: 'Erro no servidor ao fazer login.' });
    }
});

module.exports = router;