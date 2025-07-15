// models/User.js

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
    nome: {
        type: String,
        required: [true, 'O nome é obrigatório.'],
        trim: true
    },
    email: {
        type: String,
        required: [true, 'O e-mail é obrigatório.'],
        unique: true,
        lowercase: true,
        trim: true
    },
    senha: {
        type: String,
        required: [true, 'A senha é obrigatória.'],
        minlength: 6
    },
    // --- CAMPOS NOVOS PARA MULTI-EMPRESA ---
    companyId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Company', // Cria uma referência ao nosso modelo 'Company'
        required: true
    },
    role: {
        type: String,
        enum: ['admin', 'profissional'], // Tipos de usuário permitidos
        default: 'profissional'
    }
    // ----------------------------------------
}, {
    timestamps: true
});

// Middleware que criptografa a senha (permanece o mesmo)
UserSchema.pre('save', async function(next) {
    if (!this.isModified('senha')) {
        return next();
    }
    const salt = await bcrypt.genSalt(10);
    this.senha = await bcrypt.hash(this.senha, salt);
    next();
});

const User = mongoose.model('User', UserSchema);

module.exports = User;