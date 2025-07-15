// models/Company.js

const mongoose = require('mongoose');

const CompanySchema = new mongoose.Schema({
    nome: {
        type: String,
        required: [true, 'O nome da empresa é obrigatório.'],
        trim: true
    },
    cnpj: {
        type: String,
        trim: true
    },
    endereco: {
        type: String,
        trim: true
    },
    numero: {
        type: String,
        trim: true
    },
    bairro: {
        type: String,
        trim: true
    },
    cidade: {
        type: String,
        trim: true
    },
    estado: {
        type: String,
        trim: true
    },
    cep: {
        type: String,
        trim: true
    },
    cel: {
        type: String,
        trim: true
    },
    email: {
        type: String,
        trim: true,
        lowercase: true
    },
    pinCadastro: {
        type: String,
        required: [true, 'O PIN de cadastro é obrigatório.'],
        unique: true, // Garante que cada PIN seja único
        trim: true
    }
    // O companyId é o próprio _id gerado pelo MongoDB, não precisamos declará-lo aqui.
}, {
    timestamps: true
});

const Company = mongoose.model('Company', CompanySchema);

module.exports = Company;