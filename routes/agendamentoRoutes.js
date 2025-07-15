// routes/agendamentoRoutes.js

const express = require('express');
const router = express.Router();
const Agendamento = require('../models/Agendamento.js');
const Cliente = require('../models/Cliente.js');
const Transacao = require('../models/Transacao.js');

// ROTA GET PRINCIPAL - FILTRA POR MÊS E ANO
router.get('/', async (req, res) => {
    try {
        const { mes, ano } = req.query;
        let query = { companyId: req.user.companyId };

        if (mes && ano) {
            const mesNumero = parseInt(mes, 10);
            const anoNumero = parseInt(ano, 10);
            const dataInicio = new Date(anoNumero, mesNumero - 1, 1);
            const dataFim = new Date(anoNumero, mesNumero, 0, 23, 59, 59, 999);
            query.dataAgendamento = { $gte: dataInicio, $lte: dataFim };
        }

        const agendamentos = await Agendamento.find(query).populate('cliente', 'nome').sort({ dataAgendamento: 1 });
        res.status(200).json(agendamentos);
    } catch (error) {
        res.status(500).json({ message: 'Erro ao buscar agendamentos.' });
    }
});

// ROTA PARA O RESUMO DO DASHBOARD
router.get('/summary/dashboard', async (req, res) => {
    try {
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        const amanha = new Date(hoje);
        amanha.setDate(hoje.getDate() + 1);
        const inicioSemana = new Date(hoje);
        inicioSemana.setDate(hoje.getDate() - hoje.getDay());
        const fimSemana = new Date(inicioSemana);
        fimSemana.setDate(inicioSemana.getDate() + 7);

        const [totalHoje, totalSemana, totalConfirmados, totalConcluidos] = await Promise.all([
            Agendamento.countDocuments({ companyId: req.user.companyId, dataAgendamento: { $gte: hoje, $lt: amanha } }),
            Agendamento.countDocuments({ companyId: req.user.companyId, dataAgendamento: { $gte: inicioSemana, $lt: fimSemana } }),
            Agendamento.countDocuments({ companyId: req.user.companyId, status: 'Confirmado' }),
            Agendamento.countDocuments({ companyId: req.user.companyId, status: 'Concluído' })
        ]);
        res.status(200).json({ hoje: totalHoje, semana: totalSemana, confirmados: totalConfirmados, concluidos: totalConcluidos });
    } catch (error) { res.status(500).json({ message: 'Erro no servidor ao buscar resumo.' }); }
});

// ROTA PARA OS AGENDAMENTOS DE HOJE
router.get('/hoje', async (req, res) => {
    try {
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        const amanha = new Date(hoje);
        amanha.setDate(hoje.getDate() + 1);
        const agendamentosDeHoje = await Agendamento.find({ companyId: req.user.companyId, dataAgendamento: { $gte: hoje, $lt: amanha } }).populate('cliente', 'nome').sort({ dataAgendamento: 1 });
        res.status(200).json(agendamentosDeHoje);
    } catch (error) { res.status(500).json({ message: 'Erro no servidor ao buscar agendamentos de hoje.' }); }
});

// ROTA PARA RELATÓRIOS
router.get('/relatorio', async (req, res) => {
    try {
        const { dataInicio, dataFim, status } = req.query;
        let query = { companyId: req.user.companyId };
        if (dataInicio && dataFim) {
            query.dataAgendamento = { $gte: new Date(dataInicio), $lte: new Date(new Date(dataFim).setHours(23, 59, 59, 999)) };
        }
        if (status && status !== 'Todos') {
            query.status = status;
        }
        const agendamentos = await Agendamento.find(query).populate('cliente', 'nome').sort({ dataAgendamento: 1 });
        res.status(200).json(agendamentos);
    } catch (error) { res.status(500).json({ message: 'Erro no servidor ao gerar relatório.' }); }
});

// ROTA POST: Cria um novo agendamento
router.post('/', async (req, res) => {
    try {
        const novoAgendamento = new Agendamento({ ...req.body, companyId: req.user.companyId });
        await novoAgendamento.save();
        res.status(201).json({ message: 'Agendamento criado com sucesso!', data: novoAgendamento });
    } catch (error) { res.status(400).json({ message: 'Erro ao criar agendamento.'}); }
});

// ROTA PUT: Atualiza um agendamento
router.put('/:id', async (req, res) => {
    try {
        const agendamento = await Agendamento.findOneAndUpdate({ _id: req.params.id, companyId: req.user.companyId }, req.body, { new: true, runValidators: true });
        if (!agendamento) return res.status(404).json({ message: 'Agendamento não encontrado.' });
        res.status(200).json({ message: 'Agendamento atualizado com sucesso!', data: agendamento });
    } catch (error) { res.status(400).json({ message: 'Erro ao atualizar agendamento.'}); }
});

// ROTA DELETE: Exclui um agendamento
router.delete('/:id', async (req, res) => {
    try {
        const agendamento = await Agendamento.findOne({ _id: req.params.id, companyId: req.user.companyId });
        if (!agendamento) return res.status(404).json({ message: 'Agendamento não encontrado.' });
        if (agendamento.status === 'Concluído') return res.status(403).json({ message: 'Não é possível excluir um agendamento já concluído.' });
        await Agendamento.findByIdAndDelete(req.params.id);
        res.status(200).json({ message: 'Agendamento excluído com sucesso!' });
    } catch (error) { res.status(500).json({ message: 'Erro ao excluir agendamento.' }); }
});

// ROTA PATCH: Atualiza o status
router.patch('/:id/status', async (req, res) => {
    try {
        const { status } = req.body;
        const agendamento = await Agendamento.findOne({ _id: req.params.id, companyId: req.user.companyId }).populate('cliente', 'nome');
        if (!agendamento) return res.status(404).json({ message: 'Agendamento não encontrado.' });
        agendamento.status = status;
        await agendamento.save();
        if (status === 'Concluído') {
            const transacaoExistente = await Transacao.findOne({ agendamentoId: agendamento._id });
            if (!transacaoExistente) {
                const novaReceita = new Transacao({
                    tipo: 'Receita',
                    descricao: `Serviços para ${agendamento.cliente.nome}: ${agendamento.procedimentos.map(p => p.nome).join(', ')}`,
                    valor: agendamento.valorTotal,
                    data: agendamento.dataAgendamento,
                    agendamentoId: agendamento._id,
                    companyId: req.user.companyId
                });
                await novaReceita.save();
            }
        }
        res.status(200).json({ message: `Status alterado para ${status}!`, data: agendamento });
    } catch (error) { res.status(500).json({ message: 'Erro ao atualizar status.' }); }
});

module.exports = router;