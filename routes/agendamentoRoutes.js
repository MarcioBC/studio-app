// routes/agendamentoRoutes.js

const express = require('express');
const router = express.Router();
const Agendamento = require('../models/Agendamento.js');
const Cliente = require('../models/Cliente.js'); // Necessário para o $lookup no aggregation
const Transacao = require('../models/Transacao.js'); // Usado em outras rotas
const moment = require('moment-timezone'); 
const mongoose = require('mongoose'); 

// Defina o fuso horário do seu Studio para Sorocaba
const STUDIO_TIMEZONE = 'America/Sao_Paulo';

// ROTA GET PRINCIPAL - FILTRA POR DIA OU MÊS E NOVOS CRITÉRIOS DE BUSCA USANDO AGGREGATION
router.get('/', async (req, res) => {
    try {
        // Agora o frontend envia 'data' para filtro por dia, e 'search' para busca por texto.
        const { data, mes, ano, search } = req.query; 
        let matchQuery = { companyId: new mongoose.Types.ObjectId(req.user.companyId) }; 
        let sortOption = { dataAgendamento: 1 }; // PADRÃO: DO MAIS ANTIGO PARA O MAIS RECENTE (útil para listagens diárias)

        // 1. Filtrar por Data Específica (prioridade mais alta se 'data' for fornecida)
        if (data) {
            // Interpreta a 'data' (YYYY-MM-DD) no fuso horário do Studio e cria um range de 24h
            const dataLocal = moment.tz(data, STUDIO_TIMEZONE);
            if (!dataLocal.isValid()) {
                return res.status(400).json({ message: 'Formato de data inválido. Use YYYY-MM-DD.' });
            }
            const startOfDayUTC = dataLocal.startOf('day').toDate();
            const endOfDayUTC = dataLocal.endOf('day').toDate();
            
            matchQuery.dataAgendamento = { $gte: startOfDayUTC, $lte: endOfDayUTC };
            console.log(`Backend: Filtrando por DIA específico entre ${startOfDayUTC.toISOString()} e ${endOfDayUTC.toISOString()}`);
        } 
        // 2. Filtrar por Mês e Ano (se 'data' não for fornecida)
        else if (mes && ano) { // Esta condição será menos usada com o novo frontend
            const mesNumero = parseInt(mes, 10);
            const anoNumero = parseInt(ano, 10);

            const dataInicioLocal = moment.tz(`${anoNumero}-${String(mesNumero).padStart(2, '0')}-01`, STUDIO_TIMEZONE).startOf('month');
            const dataFimLocal = moment.tz(`${anoNumero}-${String(mesNumero).padStart(2, '0')}-01`, STUDIO_TIMEZONE).endOf('month');

            const dataInicioUTC = dataInicioLocal.toDate(); 
            const dataFimUTC = dataFimLocal.toDate();     
            
            matchQuery.dataAgendamento = { $gte: dataInicioUTC, $lte: dataFimUTC };
            console.log(`Backend: Filtrando por MÊS e ANO entre ${dataInicioUTC.toISOString()} e ${dataFimUTC.toISOString()}`);
        }
        // Se nenhum filtro de data for fornecido (não esperado com o novo frontend, mas fallback)
        else {
            // Pode definir um padrão, como o mês atual, ou retornar um erro.
            // Por enquanto, o filtro de companyId já está lá.
            console.log("Backend: Nenhuma data ou mês/ano fornecido para filtro inicial.");
        }


        // 3. Lógica de Busca / Filtro por Texto usando $match na pipeline
        // Aplica a busca por texto SEMPRE que o parâmetro 'search' for fornecido,
        // trabalhando em conjunto com o filtro de data (se houver).
        if (search) {
            const searchRegex = new RegExp(search, 'i'); // 'i' para case-insensitive
            
            matchQuery.$or = [
                // Cliente populado (campo renomeado para 'clienteInfo.nome' após $lookup)
                { 'clienteInfo.nome': searchRegex },
                { profissional: searchRegex },            
                { sala: searchRegex },                    
                { 'procedimentos.nome': searchRegex }    
            ];
            console.log(`Backend: Adicionando filtro de texto: "${search}"`);
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
            // Reconstroi o matchQuery para não usar companyId duas vezes (já foi aplicado no Stage 1)
            { 
                $match: { 
                    ... (matchQuery.dataAgendamento ? { dataAgendamento: matchQuery.dataAgendamento } : {}),
                    ... (matchQuery.$or ? { $or: matchQuery.$or } : {})
                } 
            },

            // Stage 5: Ordenar os resultados (do mais antigo para o mais recente - para listagem diária)
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

// NOVA ROTA: Retorna os dias do mês com agendamentos para marcadores no calendário
router.get('/datas-com-agendamento', async (req, res) => {
    try {
        const { mes, ano } = req.query;
        if (!mes || !ano) {
            return res.status(400).json({ message: "Parâmetros 'mes' e 'ano' são obrigatórios." });
        }

        const mesNumero = parseInt(mes, 10);
        const anoNumero = parseInt(ano, 10);

        // Calcula o início e o fim do mês no fuso horário do Studio para a consulta
        const startOfMonthLocal = moment.tz(`${anoNumero}-${String(mesNumero).padStart(2, '0')}-01`, STUDIO_TIMEZONE).startOf('month');
        const endOfMonthLocal = moment.tz(`${anoNumero}-${String(mesNumero).padStart(2, '0')}-01`, STUDIO_TIMEZONE).endOf('month');

        const startOfMonthUTC = startOfMonthLocal.toDate();
        const endOfMonthUTC = endOfMonthLocal.toDate();

        const distinctDays = await Agendamento.aggregate([
            {
                $match: {
                    companyId: new mongoose.Types.ObjectId(req.user.companyId), // Filtra pela empresa
                    dataAgendamento: {
                        $gte: startOfMonthUTC,
                        $lte: endOfMonthUTC
                    }
                }
            },
            {
                $project: {
                    // Extrai o dia do mês (1 a 31) na timezone do Studio
                    dayOfMonth: { $dayOfMonth: { date: "$dataAgendamento", timezone: STUDIO_TIMEZONE } }
                }
            },
            {
                $group: {
                    _id: null,
                    days: { $addToSet: "$dayOfMonth" } // Coleta os dias únicos
                }
            },
            {
                $project: {
                    _id: 0,
                    days: { $sortArray: { input: "$days", sortBy: 1 } } // Opcional: ordenar os dias
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