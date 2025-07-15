// models/Cliente.js
const mongoose = require('mongoose');
const ClienteSchema = new mongoose.Schema({
    nome: { type: String, required: true, trim: true },
    telefone: { type: String, required: true, trim: true },
    cpf: { type: String, trim: true },
    dataNascimento: { type: Date },
    cep: { type: String, trim: true },
    logradouro: { type: String, trim: true },
    numero: { type: String, trim: true },
    complemento: { type: String, trim: true },
    bairro: { type: String, trim: true },
    cidade: { type: String, trim: true },
    estado: { type: String, trim: true },
    // --- CAMPO ADICIONADO ---
    companyId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Company',
        required: true
    }
}, { timestamps: true });
// Garante que a combinação de telefone e empresa seja única
ClienteSchema.index({ telefone: 1, companyId: 1 }, { unique: true });
const Cliente = mongoose.model('Cliente', ClienteSchema);
module.exports = Cliente;