// routes/profissionalRoutes.js

const express = require('express');
const router = express.Router();
const Profissional = require('../models/Profissional.js');

// GET /: Lista os profissionais DA EMPRESA LOGADA
router.get('/', async (req, res) => {
    try {
        const profissionais = await Profissional.find({ companyId: req.user.companyId }).sort({ nome: 1 });
        res.status(200).json(profissionais);
    } catch (error) {
        res.status(500).json({ message: 'Erro ao buscar profissionais.' });
    }
});

// POST /: Cria um profissional PARA A EMPRESA LOGADA
router.post('/', async (req, res) => {
    try {
        const novoProfissional = new Profissional({
            nome: req.body.nome,
            companyId: req.user.companyId
        });
        await novoProfissional.save();
        res.status(201).json({ message: 'Profissional adicionado com sucesso!', data: novoProfissional });
    } catch (error) {
        if (error.code === 11000) return res.status(409).json({ message: 'Este profissional já existe.' });
        res.status(400).json({ message: 'Erro ao adicionar profissional.', error });
    }
});

// DELETE /:id: Exclui um profissional DA EMPRESA LOGADA
router.delete('/:id', async (req, res) => {
    try {
        const profissionalExcluido = await Profissional.findOneAndDelete({ _id: req.params.id, companyId: req.user.companyId });
        if (!profissionalExcluido) return res.status(404).json({ message: 'Profissional não encontrado.' });
        res.status(200).json({ message: 'Profissional excluído com sucesso!' });
    } catch (error) {
        res.status(500).json({ message: 'Erro ao excluir profissional.' });
    }
});

module.exports = router;