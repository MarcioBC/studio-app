// models/Profissional.js
const mongoose = require('mongoose');
const ProfissionalSchema = new mongoose.Schema({
    nome: { type: String, required: true, trim: true },
    // --- CAMPO ADICIONADO ---
    companyId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Company',
        required: true
    }
}, { timestamps: true });
// Garante que o nome do profissional seja único por empresa
ProfissionalSchema.index({ nome: 1, companyId: 1 }, { unique: true });
const Profissional = mongoose.model('Profissional', ProfissionalSchema);
module.exports = Profissional;