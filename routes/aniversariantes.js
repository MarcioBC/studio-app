const express = require('express');
const router = express.Router();
const Cliente = require('../models/Cliente'); // Caminho para o seu modelo de Cliente

// CORREÇÃO AQUI: Importa 'protect' desestruturando o objeto que authMiddleware.js exporta
const { protect } = require('../middleware/authMiddleware');

// Importe moment-timezone
const moment = require('moment-timezone');

// Defina o fuso horário do seu Studio
// Sorocaba, São Paulo é 'America/Sao_Paulo'
const STUDIO_TIMEZONE = 'America/Sao_Paulo';

/**
 * @route GET /api/aniversariantes-do-dia
 * @desc Busca todos os clientes que fazem aniversário no dia atual
 * @access Private (requer token de autenticação)
 */
router.get('/aniversariantes-do-dia', protect, async (req, res) => {
    try {
        // Obter a data e hora atuais, mas no fuso horário do Studio
        const todayLocal = moment().tz(STUDIO_TIMEZONE);

        // Extrair o mês e o dia dessa data local
        // moment().month() é 0-indexed (0 para Jan, 6 para Jul)
        const currentMonth = todayLocal.month();
        // moment().date() é o dia do mês (1 a 31)
        const currentDay = todayLocal.date();

        console.log(`Backend - Aniversariantes: Buscando para Mês: ${currentMonth + 1}, Dia: ${currentDay} (no fuso horário do Studio: ${STUDIO_TIMEZONE})`);

        // Para a consulta no MongoDB, $month retorna o mês de 1 a 12.
        // Por isso, somamos 1 ao currentMonth do JavaScript/Moment.js.
        const aniversariantes = await Cliente.find({
            $expr: {
                $and: [
                    { $eq: [{ $month: '$dataNascimento' }, currentMonth + 1] }, // Compara o mês (1-indexed no DB)
                    { $eq: [{ $dayOfMonth: '$dataNascimento' }, currentDay] }   // Compara o dia do mês
                ]
            }
        }).select('nome dataNascimento telefone'); // Seleciona apenas os campos necessários para a resposta

        console.log(`Backend - Aniversariantes: Encontrados ${aniversariantes.length} aniversariantes.`);
        res.json(aniversariantes);

    } catch (error) {
        console.error('Erro ao buscar aniversariantes do dia:', error);
        res.status(500).json({ message: 'Erro interno do servidor ao buscar aniversariantes.' });
    }
});

module.exports = router;