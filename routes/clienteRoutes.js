// routes/clienteRoutes.js

const express = require('express');
const router = express.Router();
const Cliente = require('../models/Cliente.js');

// Rota GET /: Busca todos os clientes DA EMPRESA LOGADA
router.get('/', async (req, res) => {
    try {
        const clientes = await Cliente.find({ companyId: req.user.companyId }).sort({ nome: 1 });
        res.status(200).json(clientes);
    } catch (error) {
        res.status(500).json({ message: 'Erro ao buscar clientes.' });
    }
});

// Rota POST /check-phone: Verifica o telefone DENTRO DA EMPRESA LOGADA
router.post('/check-phone', async (req, res) => {
    const { telefone } = req.body;
    try {
        const clienteExistente = await Cliente.findOne({ 
            telefone: telefone,
            companyId: req.user.companyId // Só busca na empresa do usuário atual
        });

        if (clienteExistente) {
            return res.json({ success: false, message: 'Cliente já existe no banco de dados desta empresa.' });
        } else {
            return res.json({ success: true, message: 'Telefone disponível para cadastro.' });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// Rota POST /register: Cria um cliente PARA A EMPRESA LOGADA
router.post('/register', async (req, res) => {
    try {
        const novoCliente = new Cliente({
            ...req.body, // Pega todos os dados do formulário
            companyId: req.user.companyId // Adiciona o ID da empresa do usuário logado
        });
        await novoCliente.save();
        res.status(201).json({ message: 'Cliente registrado com sucesso!', cliente: novoCliente });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({ message: 'Erro: O telefone fornecido já está em uso nesta empresa.' });
        }
        res.status(400).json({ message: 'Erro ao registrar cliente.', error: error.message });
    }
});

// Adicione aqui as futuras rotas de Editar e Excluir Clientes...
// Rota DELETE /:id: Exclui um cliente da empresa logada
router.delete('/:id', async (req, res) => {
    try {
        // Verifica se o usuário está autenticado e tem companyId
        if (!req.user || !req.user.companyId) {
            return res.status(401).json({ message: 'Usuário não autenticado ou sem ID de empresa.' });
        }

        const { id } = req.params; // ID do cliente a ser excluído

        // Encontra e deleta o cliente APENAS se ele pertence à companyId do usuário logado
        const cliente = await Cliente.findOneAndDelete({ _id: id, companyId: req.user.companyId });

        if (!cliente) {
            // Se não encontrar, pode ser 404 (não existe) ou 403 (existe, mas não pertence ao usuário)
            return res.status(404).json({ message: 'Cliente não encontrado ou não pertence à sua empresa.' });
        }

        res.status(200).json({ message: 'Cliente excluído com sucesso!' });

    } catch (error) {
        console.error("Erro ao excluir cliente:", error);
        res.status(500).json({ message: 'Erro interno do servidor ao excluir cliente.' });
    }
});

module.exports = router;