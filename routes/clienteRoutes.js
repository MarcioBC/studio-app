// routes/clienteRoutes.js

const express = require('express');
const router = express.Router();
const Cliente = require('../models/Cliente.js'); // Certifique-se de que o modelo Cliente está correto

// Rota GET /: Busca todos os clientes DA EMPRESA LOGADA, com opção de busca
router.get('/', async (req, res) => {
    try {
        const { search } = req.query; // Pega o parâmetro de busca da query string
        let query = { companyId: req.user.companyId }; // Filtro inicial por empresa logada

        console.log("Backend: Requisição de clientes recebida. Termo de busca (original):", search); // Log de depuração

        // NOVO: Lógica de Busca por Nome ou Telefone - CORRIGIDA PARA AMBOS OS CASOS
        if (search && search.length > 0) { // Garante que 'search' não é vazio ou undefined
            let orConditions = [];

            // 1. Condição de busca por NOME
            // Sempre tentamos buscar por nome usando o termo original
            const nameSearchRegex = new RegExp(search, 'i'); // Regex para busca por nome (case-insensitive)
            orConditions.push({ nome: nameSearchRegex });
            console.log("Backend: Condição de busca por nome adicionada:", { nome: nameSearchRegex });

            // 2. Condição de busca por TELEFONE
            // Remove a máscara do telefone para buscar. Só adiciona se o termo de busca tiver dígitos.
            const unmaskedSearch = search.replace(/\D/g, ''); // Remove todos os não-dígitos
            
            // Adiciona a condição de telefone SOMENTE se houver dígitos no termo de busca
            if (unmaskedSearch.length > 0) {
                const phoneSearchRegex = new RegExp(unmaskedSearch, 'i'); // Regex para busca por telefone (sem máscara)
                orConditions.push({ telefone: phoneSearchRegex });
                console.log("Backend: Condição de busca por telefone adicionada:", { telefone: phoneSearchRegex });
            }

            // Atribui as condições $or à query, se houver condições válidas
            if (orConditions.length > 0) {
                query.$or = orConditions;
            }
            // Se orConditions estiver vazio (o que é improvável com a busca por nome),
            // a query não terá $or, e retornará todos os clientes da empresa (com base apenas em companyId).
        }

        console.log("Backend: Query final para o MongoDB:", JSON.stringify(query, null, 2)); // Log da query final

        const clientes = await Cliente.find(query).sort({ nome: 1 }); // Aplica a query e ordena
        res.status(200).json(clientes);
    } catch (error) {
        console.error("Erro ao buscar clientes:", error); // Adicionei log para depuração
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
        console.error("Erro ao verificar telefone:", error); // Adicionei log para depuração
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
        console.error("Erro ao registrar cliente:", error); // Adicionei log para depuração
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