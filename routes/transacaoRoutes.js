// routes/transacaoRoutes.js

const express = require('express');
const router = express.Router();
const Transacao = require('../models/Transacao.js');
// --- PASSO 1 DA CORREÇÃO: Importar o ObjectId ---
const { Types } = require('mongoose');

// Rota GET /: Busca transações por mês/ano e empresa
router.get('/', async (req, res) => {
    try {
        const { mes, ano } = req.query;
        const query = { companyId: req.user.companyId };

        if (mes && ano) {
            const mesNumero = parseInt(mes, 10);
            const anoNumero = parseInt(ano, 10);
            const dataInicio = new Date(anoNumero, mesNumero - 1, 1);
            const dataFim = new Date(anoNumero, mesNumero, 0, 23, 59, 59, 999);
            query.data = { $gte: dataInicio, $lte: dataFim };
        }
        
        const transacoes = await Transacao.find(query).sort({ data: -1 });
        res.status(200).json(transacoes);
    } catch (error) {
        res.status(500).json({ message: 'Erro ao buscar transações.' });
    }
});

// Rota GET /summary: Calcula os totais por mês/ano e empresa (COM A CORREÇÃO FINAL)
router.get('/summary', async (req, res) => {
    try {
        const { mes, ano } = req.query;
        
        // --- PASSO 2 DA CORREÇÃO: Construir o $match de forma mais robusta ---
        const mesNumero = parseInt(mes, 10);
        const anoNumero = parseInt(ano, 10);
        const dataInicio = new Date(anoNumero, mesNumero - 1, 1);
        const dataFim = new Date(anoNumero, mesNumero, 0, 23, 59, 59, 999);

        const summary = await Transacao.aggregate([
            {
                $match: {
                    // Garantimos que a comparação seja feita com um ObjectId real
                    companyId: new Types.ObjectId(req.user.companyId),
                    data: {
                        $gte: dataInicio,
                        $lte: dataFim
                    }
                }
            },
            {
                $group: {
                    _id: '$tipo',
                    total: { $sum: '$valor' }
                }
            }
        ]);
        
        const totais = { totalReceitas: 0, totalDespesas: 0 };
        summary.forEach(item => {
            if (item._id === 'Receita') totais.totalReceitas = item.total;
            else if (item._id === 'Despesa') totais.totalDespesas = item.total;
        });
        res.status(200).json(totais);
    } catch (error) {
        console.error('ERRO NA ROTA /summary:', error);
        res.status(500).json({ message: 'Erro ao calcular resumo.' });
    }
});


// Rota GET /relatorio: Gera o relatório financeiro
router.get('/relatorio', async (req, res) => {
    try {
        const { dataInicio, dataFim } = req.query;
        if (!dataInicio || !dataFim) {
            return res.status(400).json({ message: 'Datas de início e fim são obrigatórias.' });
        }
        const query = {
            companyId: req.user.companyId,
            data: { $gte: new Date(dataInicio), $lte: new Date(new Date(dataFim).setHours(23, 59, 59, 999)) }
        };
        const transacoesDoPeriodo = await Transacao.find(query).sort({ data: 1 });
        let totalReceitas = 0, totalDespesas = 0;
        const receitasList = [], despesasList = [];
        transacoesDoPeriodo.forEach(t => {
            if (t.tipo === 'Receita') { totalReceitas += t.valor; receitasList.push(t); } 
            else { totalDespesas += t.valor; despesasList.push(t); }
        });
        res.status(200).json({
            summary: { totalReceitas, totalDespesas, saldo: totalReceitas - totalDespesas },
            receitas: receitasList, despesas: despesasList, todas: transacoesDoPeriodo
        });
    } catch (error) {
        res.status(500).json({ message: 'Erro no servidor ao gerar relatório financeiro.' });
    }
});

// Rota POST: Cria uma nova transação
router.post('/', async (req, res) => {
    try {
        const novaTransacao = new Transacao({ ...req.body, companyId: req.user.companyId });
        await novaTransacao.save();
        res.status(201).json({ success: true, message: 'Transação adicionada com sucesso!' });
    } catch (error) {
        res.status(500).json({ message: 'Erro interno do servidor.' });
    }
});

// Rota DELETE: Exclui uma transação
router.delete('/:id', async (req, res) => {
    try {
        const transacao = await Transacao.findOne({ _id: req.params.id, companyId: req.user.companyId });
        if (!transacao) return res.status(404).json({ message: 'Transação não encontrada.' });
        if (transacao.agendamentoId) return res.status(403).json({ message: 'Não é possível excluir uma receita gerada por um agendamento.' });
        await Transacao.findByIdAndDelete(req.params.id);
        res.status(200).json({ message: 'Transação excluída com sucesso!' });
    } catch (error) {
        res.status(500).json({ message: 'Erro ao excluir transação.' });
    }
});

module.exports = router;