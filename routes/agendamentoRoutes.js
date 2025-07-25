// routes/agendamentoRoutes.js

const express = require('express');
const router = express.Router();
const Agendamento = require('../models/Agendamento.js');
const Cliente = require('../models/Cliente.js'); 
const Transacao = require('../models/Transacao.js'); 
const moment = require('moment-timezone'); 
const mongoose = require('mongoose'); 

const STUDIO_TIMEZONE = 'America/Sao_Paulo';

// ROTA GET PRINCIPAL - FILTRA POR DIA OU MÊS E CRITÉRIOS DE BUSCA
// Acessível via /api/ (ou /api/?data=YYYY-MM-DD ou /api/?mes=X&ano=Y)
router.get('/', async (req, res) => { // NÃO PRECISA DE PREFIXO AQUI
    try {
        const { data, mes, ano, search } = req.query; 
        let matchQuery = { companyId: new mongoose.Types.ObjectId(req.user.companyId) }; 
        let sortOption = { dataAgendamento: 1 }; 

        if (data) {
            const dataLocal = moment.tz(data, STUDIO_TIMEZONE);
            if (!dataLocal.isValid()) {
                return res.status(400).json({ message: 'Formato de data inválido. Use YYYY-MM-DD.' });
            }
            const startOfDayUTC = dataLocal.startOf('day').toDate();
            const endOfDayUTC = dataLocal.endOf('day').toDate();
            
            matchQuery.dataAgendamento = { $gte: startOfDayUTC, $lte: endOfDayUTC };
            console.log(`Backend: Filtrando por DIA específico entre ${startOfDayUTC.toISOString()} e ${endOfDayUTC.toISOString()}`);
        } 
        else if (mes && ano) {
            const mesNumero = parseInt(mes, 10);
            const anoNumero = parseInt(ano, 10);

            const dataInicioLocal = moment.tz(`${anoNumero}-${String(mesNumero).padStart(2, '0')}-01`, STUDIO_TIMEZONE).startOf('month');
            const dataFimLocal = moment.tz(`${anoNumero}-${String(mesNumero).padStart(2, '0')}-01`, STUDIO_TIMEZONE).endOf('month');

            const dataInicioUTC = dataInicioLocal.toDate(); 
            const dataFimUTC = dataFimLocal.toDate();     
            
            matchQuery.dataAgendamento = { $gte: dataInicioUTC, $lte: dataFimUTC };
            console.log(`Backend: Filtrando por MÊS e ANO entre ${dataInicioUTC.toISOString()} e ${dataFimUTC.toISOString()}`);
        }
        else {
            console.log("Backend: Nenhuma data ou mês/ano fornecido para filtro inicial.");
        }

        if (search) {
            const searchRegex = new RegExp(search, 'i'); 
            
            matchQuery.$or = [
                { 'clienteInfo.nome': searchRegex },
                { profissional: searchRegex },            
                { sala: searchRegex },                    
                { 'procedimentos.nome': searchRegex }    
            ];
            console.log(`Backend: Adicionando filtro de texto: "${search}"`);
        }
        
        const pipeline = [
            { $match: { companyId: matchQuery.companyId } },
            {
                $lookup: {
                    from: 'clientes', 
                    localField: 'cliente',
                    foreignField: '_id',
                    as: 'clienteInfo'
                }
            },
            { $unwind: { path: '$clienteInfo', preserveNullAndEmptyArrays: true } },
            { 
                $match: { 
                    ... (matchQuery.dataAgendamento ? { dataAgendamento: matchQuery.dataAgendamento } : {}),
                    ... (matchQuery.$or ? { $or: matchQuery.$or } : {})
                } 
            },
            { $sort: sortOption },
            {
                $project: {
                    _id: 1,
                    dataAgendamento: 1,
                    status: 1,
                    valorTotal: 1,
                    profissional: 1,
                    sala: 1,
                    observacoes: 1,
                    procedimentos: 1, 
                    cliente: '$clienteInfo' 
                }
            }
        ];

        const agendamentos = await Agendamento.aggregate(pipeline);
        res.status(200).json(agendamentos);

    } catch (error) {
        console.error("Erro ao buscar agendamentos com busca:", error);
        res.status(500).json({ message: 'Erro interno do servidor ao buscar agendamentos.' });
    }
});

// ROTA PARA O RESUMO DO DASHBOARD (Cards de contagem)
// Acessível via /api/agendamentos/dashboard/summary
// ASSUMIMOS QUE SEU app.js JÁ COLOCA '/api/agendamentos'
router.get('/dashboard/summary', async (req, res) => { // REMOVIDO '/agendamentos' DAQUI
    try {
        const startOfTodayLocal = moment().tz(STUDIO_TIMEZONE).startOf('day');
        const endOfTodayLocal = moment().tz(STUDIO_TIMEZONE).endOf('day');
        const startOfWeekLocal = moment().tz(STUDIO_TIMEZONE).startOf('week');
        const endOfWeekLocal = moment().tz(STUDIO_TIMEZONE).endOf('week');

        const startOfTodayUTC = startOfTodayLocal.toDate();
        const endOfTodayUTC = endOfTodayLocal.toDate();
        const startOfWeekUTC = startOfWeekLocal.toDate();
        const endOfWeekUTC = endOfWeekLocal.toDate();

        const [totalHoje, totalSemana, totalConfirmados, totalConcluidos] = await Promise.all([
            Agendamento.countDocuments({ companyId: req.user.companyId, dataAgendamento: { $gte: startOfTodayUTC, $lte: endOfTodayUTC } }),
            Agendamento.countDocuments({ companyId: req.user.companyId, dataAgendamento: { $gte: startOfWeekUTC, $lte: endOfWeekUTC } }),
            Agendamento.countDocuments({ companyId: req.user.companyId, status: 'Confirmado' }),
            Agendamento.countDocuments({ companyId: req.user.companyId, status: 'Concluído' })
        ]);
        res.status(200).json({
            hoje: totalHoje,
            semana: totalSemana,
            confirmados: totalConfirmados,
            concluidos: totalConcluidos
        });
    } catch (error) {
        console.error("Erro no servidor ao buscar resumo:", error);
        res.status(500).json({ message: 'Erro interno do servidor ao buscar resumo.' });
    }
});

// ROTA PARA OS AGENDAMENTOS DE HOJE (Listagem detalhada do dia no Dashboard)
// Acessível via /api/agendamentos/hoje
router.get('/hoje', async (req, res) => { // REMOVIDO '/agendamentos' DAQUI
    try {
        const startOfTodayLocal = moment().tz(STUDIO_TIMEZONE).startOf('day');
        const endOfTodayLocal = moment().tz(STUDIO_TIMEZONE).endOf('day');

        const startOfTodayUTC = startOfTodayLocal.toDate();
        const endOfTodayUTC = endOfTodayLocal.toDate();

        const agendamentosDeHoje = await Agendamento.find({ companyId: req.user.companyId, dataAgendamento: { $gte: startOfTodayUTC, $lte: endOfTodayUTC } }).populate('cliente', 'nome').sort({ dataAgendamento: 1 });
        res.status(200).json(agendamentosDeHoje);
    } catch (error) {
        console.error("Erro no servidor ao buscar agendamentos de hoje:", error);
        res.status(500).json({ message: 'Erro no servidor ao buscar agendamentos de hoje.' });
    }
});

// ROTA PARA OS DIAS COM AGENDAMENTO PARA O CALENDÁRIO
// Acessível via /api/agendamentos/datas-com-agendamento
router.get('/datas-com-agendamento', async (req, res) => { // REMOVIDO '/agendamentos' DAQUI
    try {
        const { mes, ano } = req.query;
        if (!mes || !ano) {
            return res.status(400).json({ message: "Parâmetros 'mes' e 'ano' são obrigatórios." });
        }

        const mesNumero = parseInt(mes, 10);
        const anoNumero = parseInt(ano, 10);

        const startOfMonthLocal = moment.tz(`${anoNumero}-${String(mesNumero).padStart(2, '0')}-01`, STUDIO_TIMEZONE).startOf('month');
        const endOfMonthLocal = moment.tz(`${anoNumero}-${String(mesNumero).padStart(2, '0')}-01`, STUDIO_TIMEZONE).endOf('month');

        const startOfMonthUTC = startOfMonthLocal.toDate();
        const endOfMonthUTC = endOfMonthLocal.toDate();

        const distinctDays = await Agendamento.aggregate([
            {
                $match: {
                    companyId: new mongoose.Types.ObjectId(req.user.companyId),
                    dataAgendamento: {
                        $gte: startOfMonthUTC,
                        $lte: endOfMonthUTC
                    }
                }
            },
            {
                $project: {
                    dayOfMonth: { $dayOfMonth: { date: "$dataAgendamento", timezone: STUDIO_TIMEZONE } }
                }
            },
            {
                $group: {
                    _id: null,
                    days: { $addToSet: "$dayOfMonth" }
                }
            },
            {
                $project: {
                    _id: 0,
                    days: { $sortArray: { input: "$days", sortBy: 1 } }
                }
            }
        ]);

        const daysWithAppointments = distinctDays.length > 0 ? distinctDays[0].days : [];
        res.status(200).json(daysWithAppointments);

    } catch (error) {
        console.error("Erro no backend ao buscar dias com agendamento:", error);
        res.status(500).json({ message: "Erro interno do servidor." });
    }
});

router.get('/relatorio', async (req, res) => {
    try {
        const { dataInicio, dataFim, status } = req.query;
        let query = { companyId: req.user.companyId };

        if (dataInicio && dataFim) {
            const inicioLocal = moment.tz(dataInicio, STUDIO_TIMEZONE).startOf('day');
            const fimLocal = moment.tz(dataFim, STUDIO_TIMEZONE).endOf('day');

            const inicioUTC = inicioLocal.toDate();
            const fimUTC = fimLocal.toDate();

            query.dataAgendamento = { $gte: inicioUTC, $lte: fimUTC };
        }
        if (status && status !== 'Todos') {
            query.status = status;
        }
        const agendamentos = await Agendamento.find(query).populate('cliente', 'nome').sort({ dataAgendamento: 1 });
        res.status(200).json(agendamentos);
    } catch (error) {
        console.error("Erro no servidor ao gerar relatório:", error);
        res.status(500).json({ message: 'Erro no servidor ao gerar relatório.' });
    }
});

router.post('/', async (req, res) => {
    try {
        const novoAgendamento = new Agendamento({ ...req.body, companyId: req.user.companyId });
        await novoAgendamento.save();
        res.status(201).json({ message: 'Agendamento criado com sucesso!', data: novoAgendamento });
    } catch (error) {
        console.error("Erro ao criar agendamento:", error);
        res.status(400).json({ message: 'Erro ao criar agendamento.'});
    }
});

router.put('/:id', async (req, res) => {
    try {
        const agendamento = await Agendamento.findOneAndUpdate({ _id: req.params.id, companyId: req.user.companyId }, req.body, { new: true, runValidators: true });
        if (!agendamento) return res.status(404).json({ message: 'Agendamento não encontrado.' });
        res.status(200).json({ message: 'Agendamento atualizado com sucesso!', data: agendamento });
    } catch (error) {
        console.error("Erro ao atualizar agendamento:", error);
        res.status(400).json({ message: 'Erro ao atualizar agendamento.'});
    }
});

router.delete('/:id', async (req, res) => {
    try {
        const agendamento = await Agendamento.findOne({ _id: req.params.id, companyId: req.user.companyId });
        if (!agendamento) return res.status(404).json({ message: 'Agendamento não encontrado.' });
        if (agendamento.status === 'Concluído') return res.status(403).json({ message: 'Não é possível excluir um agendamento já concluído.' });
        await Agendamento.findByIdAndDelete(req.params.id);
        res.status(200).json({ message: 'Agendamento excluído com sucesso!' });
    } catch (error) {
        console.error("Erro ao excluir agendamento:", error);
        res.status(500).json({ message: 'Erro ao excluir agendamento.' });
    }
});

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
    } catch (error) {
        console.error("Erro ao atualizar status:", error);
        res.status(500).json({ message: 'Erro ao atualizar status.' });
    }
});

module.exports = router;