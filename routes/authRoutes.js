// routes/authRoutes.js

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User.js');
const Company = require('../models/Company.js'); // <--- CRÍTICO: Este modelo PRECISA ser importado

// ... (rota /register) ...

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
        // CRÍTICO: Certifique-se que user.companyId existe e company.name também
        const company = await Company.findById(user.companyId); 
        if (!company) {
            console.error("Erro: Empresa associada ao usuário não encontrada. companyId:", user.companyId); // Adicionei log
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
                companyName: company.name // <--- ESSA LINHA DEVE ESTAR AQUI!
            }
        });

    } catch (error) {
        console.error("Erro no login:", error);
        res.status(500).json({ message: 'Erro no servidor ao fazer login.' });
    }
});

module.exports = router;