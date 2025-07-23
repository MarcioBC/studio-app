// routes/agendamentoRoutes.js

const express = require('express');
const router = express.Router();
const Agendamento = require('../models/Agendamento.js');
const Cliente = require('../models/Cliente.js'); // Necessário para o $lookup no aggregation
const Transacao = require('../models/Transacao.js'); // Usado em outras rotas
const moment = require('moment-timezone'); // IMPORTANTE: Adicione esta linha!
const mongoose = require('mongoose'); // IMPORTANTE: Adicione esta linha para usar mongoose.Types.ObjectId

// Defina o fuso horário do seu Studio para Sorocaba
const STUDIO_TIMEZONE = 'America/Sao_Paulo';

// ROTA GET PRINCIPAL - FILTRA POR MÊS, ANO E NOVOS CRITÉRIOS DE BUSCA USANDO AGGREGATION
router.get('/', async (req, res) => {
    try {
        const { mes, ano, search } = req.query;
        let matchQuery = { companyId: new mongoose.Types.ObjectId(req.user.companyId) }; // Usa ObjectId para companyId
        let sortOption = { dataAgendamento: -1 }; // PADRÃO: DO MAIS RECENTE PARA O MAIS ANTIGO

        // 1. Filtrar por Mês e Ano (lógica existente, ajustada para matchQuery)
        if (mes && ano) {
            const mesNumero = parseInt(mes, 10);
            const anoNumero = parseInt(ano, 10);

            // Calcula o início e o fim do mês no fuso horário do Studio e converte para UTC
            // Isso garante que o dia 1 do mês e o último dia do mês são corretos localmente
            const dataInicioLocal = moment.tz(`${anoNumero}-${String(mesNumero).padStart(2, '0')}-01`, STUDIO_TIMEZONE).startOf('month');
            const dataFimLocal = moment.tz(`${anoNumero}-${String(mesNumero).padStart(2, '0')}-01`, STUDIO_TIMEZONE).endOf('month');

            const dataInicioUTC = dataInicioLocal.toDate(); // Converte para Date object (UTC)
            const dataFimUTC = dataFimLocal.toDate();     // Converte para Date object (UTC)
            
            matchQuery.dataAgendamento = { $gte: dataInicioUTC, $lte: dataFimUTC };
        }

        // 2. NOVO: Lógica de Busca / Filtro por Texto ou Data Específica usando $match na pipeline
        if (search) {
            const searchRegex = new RegExp(search, 'i'); // 'i' para case-insensitive
            
            // Tenta interpretar o 'search' como uma data específica no formato YYYY-MM-DD
            if (moment(search, 'YYYY-MM-DD', true).isValid()) {
                const searchDateLocal = moment.tz(search, STUDIO_TIMEZONE).startOf('day');
                const searchDateEndLocal = moment.tz(search, STUDIO_TIMEZONE).endOf('day');
                const searchDateStartUTC = searchDateLocal.toDate();
                const searchDateEndUTC = searchDateEndLocal.toDate();

                // Se for uma data, sobrescreve o filtro de dataAgendamento para um dia específico
                matchQuery.dataAgendamento = { $gte: searchDateStartUTC, $lte: searchDateEndUTC };
                // Remove qualquer $or de busca por texto para não conflitar
                delete matchQuery.$or;
            } else {
                // Se não for uma data específica, aplica a busca por texto em múltiplos campos
                matchQuery.$or = [
                    // Cliente populado (campo renomeado para 'clienteInfo.nome' após $lookup)
                    { 'clienteInfo.nome': searchRegex },
                    { profissional: searchRegex },            // Campo direto no Agendamento
                    { sala: searchRegex },                    // Campo direto no Agendamento
                    { 'procedimentos.nome': searchRegex }    // Campo de array de objetos embutidos no Agendamento
                ];
            }
        }
        
        const pipeline = [
            // Stage 1: Filtrar agendamentos pela empresa no início para otimização
            { $match: { companyId: matchQuery.companyId } },

            // Stage 2: Fazer lookup (join) com a coleção de clientes para poder filtrar por nome do cliente
            {
                $lookup: {
                    from: 'clientes', // Nome da sua coleção de clientes no MongoDB (normalmente plural e lowercase)
                    localField: 'cliente',
                    foreignField: '_id',
                    as: 'clienteInfo'
                }
            },
            // Stage 3: $unwind o array clienteInfo para tratar cada cliente como um objeto
            // preserveNullAndEmptyArrays: true para não remover agendamentos sem cliente
            { $unwind: { path: '$clienteInfo', preserveNullAndEmptyArrays: true } },

            // Stage 4: Aplicar os filtros de data e busca por texto no conjunto já "populado"
            { $match: matchQuery },

            // Stage 5: Ordenar os resultados (do mais recente para o mais antigo)
            { $sort: sortOption },

            // Stage 6: Projetar os campos finais para o formato esperado pelo frontend
            // Inclua TODOS os campos que seu frontend espera para exibir um agendamento.
            {
                $project: {
                    _id: 1,
                    dataAgendamento: 1,
                    status: 1,
                    valorTotal: 1,
                    profissional: 1,
                    sala: 1,
                    observacoes: 1,
                    procedimentos: 1, // Se 'procedimentos' é um array de objetos embutidos, é só incluir
                    cliente: '$clienteInfo' // O campo 'cliente' agora é o documento 'clienteInfo' populado
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

// As outras rotas (summary/dashboard, /hoje, /relatorio, POST, PUT, DELETE, PATCH)
// permanecem as mesmas que já foram corrigidas para o fuso horário do Studio e não precisam de alteração aqui.
// Você deve manter o restante do seu arquivo agendamentoRoutes.js abaixo desta linha.

// ROTA PARA O RESUMO DO DASHBOARD - CORRIGIDA PARA FUSO HORÁRIO DO STUDIO
router.get('/summary/dashboard', async (req, res) => {
    try {
        // Calcula o início e o fim do dia de hoje no fuso horário do Studio
        const startOfTodayLocal = moment().tz(STUDIO_TIMEZONE).startOf('day');
        const endOfTodayLocal = moment().tz(STUDIO_TIMEZONE).endOf('day');

        // Calcula o início da semana (domingo) no fuso horário do Studio
        const startOfWeekLocal = moment().tz(STUDIO_TIMEZONE).startOf('week');
        const endOfWeekLocal = moment().tz(STUDIO_TIMEZONE).endOf('week');

        // Converte para UTC para a consulta no MongoDB (MongoDB armazena datas em UTC)
        const startOfTodayUTC = startOfTodayLocal.toDate();
        const endOfTodayUTC = endOfTodayLocal.toDate();
        const startOfWeekUTC = startOfWeekLocal.toDate();
        const endOfWeekUTC = endOfWeekLocal.toDate();

        const [totalHoje, totalSemana, totalConfirmados, totalConcluidos] = await Promise.all([
            // Agendamentos de Hoje
            Agendamento.countDocuments({ companyId: req.user.companyId, dataAgendamento: { $gte: startOfTodayUTC, $lte: endOfTodayUTC } }),
            // Agendamentos da Semana
            Agendamento.countDocuments({ companyId: req.user.companyId, dataAgendamento: { $gte: startOfWeekUTC, $lte: endOfWeekUTC } }),
            // Agendamentos Confirmados (sem mudança de data, pois é um status)
            Agendamento.countDocuments({ companyId: req.user.companyId, status: 'Confirmado' }),
            // Agendamentos Concluídos (sem mudança de data, pois é um status)
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
        res.status(500).json({ message: 'Erro no servidor ao buscar resumo.' });
    }
});

// ROTA PARA OS AGENDAMENTOS DE HOJE - CORRIGIDA PARA FUSO HORÁRIO DO STUDIO
router.get('/hoje', async (req, res) => {
    try {
        // Calcula o início e o fim do dia de hoje no fuso horário do Studio
        const startOfTodayLocal = moment().tz(STUDIO_TIMEZONE).startOf('day');
        const endOfTodayLocal = moment().tz(STUDIO_TIMEZONE).endOf('day');

        // Converte para UTC para a consulta no MongoDB
        const startOfTodayUTC = startOfTodayLocal.toDate();
        const endOfTodayUTC = endOfTodayLocal.toDate();

        const agendamentosDeHoje = await Agendamento.find({ companyId: req.user.companyId, dataAgendamento: { $gte: startOfTodayUTC, $lte: endOfTodayUTC } }).populate('cliente', 'nome').sort({ dataAgendamento: 1 });
        res.status(200).json(agendamentosDeHoje);
    } catch (error) {
        console.error("Erro no servidor ao buscar agendamentos de hoje:", error);
        res.status(500).json({ message: 'Erro no servidor ao buscar agendamentos de hoje.' });
    }
});

// ROTA PARA RELATÓRIOS - AJUSTADA PARA FUSO HORÁRIO DO STUDIO PARA dataInicio/dataFim
router.get('/relatorio', async (req, res) => {
    try {
        const { dataInicio, dataFim, status } = req.query;
        let query = { companyId: req.user.companyId };

        if (dataInicio && dataFim) {
            // Interpreta as datas de início e fim no fuso horário do Studio e ajusta para o dia completo
            const inicioLocal = moment.tz(dataInicio, STUDIO_TIMEZONE).startOf('day');
            const fimLocal = moment.tz(dataFim, STUDIO_TIMEZONE).endOf('day');

            // Converte para UTC para a consulta no MongoDB
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

// ROTA POST: Cria um novo agendamento
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

// ROTA PUT: Atualiza um agendamento
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

// ROTA DELETE: Exclui um agendamento
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
    } catch (error) {
        console.error("Erro ao atualizar status:", error);
        res.status(500).json({ message: 'Erro ao atualizar status.' });
    }
});

module.exports = router;