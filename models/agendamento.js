// models/Agendamento.js
const mongoose = require('mongoose');
const AgendamentoSchema = new mongoose.Schema({
    cliente: { type: mongoose.Schema.Types.ObjectId, ref: 'Cliente', required: true },
    procedimentos: [{ nome: { type: String, required: true }, valor: { type: Number, required: true } }],
    profissional: { type: String, required: true, trim: true },
    sala: { type: String, required: true, default: 'Sala 01' },
    dataAgendamento: { type: Date, required: true },
    valorTotal: { type: Number, required: true },
    status: { type: String, required: true, enum: ['Pendente', 'Confirmado', 'Concluído', 'Cancelado'], default: 'Pendente' },
    observacoes: { type: String, trim: true },
    // --- CAMPO ADICIONADO ---
    companyId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Company',
        required: true
    }
}, { timestamps: true });
const Agendamento = mongoose.model('Agendamento', AgendamentoSchema);
module.exports = Agendamento;