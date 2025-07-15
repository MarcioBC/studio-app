// models/Transacao.js

const mongoose = require('mongoose');

// Definição do Schema (a "planta" da sua coleção de transações)
const transacaoSchema = new mongoose.Schema({
    descricao: {
        type: String,
        required: [true, 'A descrição é obrigatória.'],
        trim: true // Remove espaços em branco no início e no fim
    },
    valor: {
        type: Number, // <-- PONTO DA CORREÇÃO: O tipo deve ser Número
        required: [true, 'O valor é obrigatório.']
    },
    tipo: {
        type: String,
        required: true,
        enum: ['Receita', 'Despesa'] // Garante que o valor seja apenas um desses dois
    },
    data: {
        type: Date,
        required: true
    },
    companyId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Company', // Referencia ao modelo de Empresa (se você tiver um)
        required: true
    },
    // Campo opcional, apenas se a transação for gerada por um agendamento
    agendamentoId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Agendamento'
    }
}, {
    // Adiciona os campos createdAt e updatedAt automaticamente
    timestamps: true 
});

// Cria e exporta o modelo a partir do schema
const Transacao = mongoose.model('Transacao', transacaoSchema);

module.exports = Transacao;