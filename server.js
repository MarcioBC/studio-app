// server.js

const express = require('express');
const mongoose = require('mongoose');
const cookieParser = require('cookie-parser');
const path = require('path');
require('dotenv').config(); 

const app = express();

// Middlewares
app.use(express.static('public')); 
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());

// Conexão com o MongoDB
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('Conexão com o MongoDB estabelecida com sucesso!'))
    .catch(err => { console.error('Erro na conexão com o MongoDB:', err.message); process.exit(1); });

// --- Importar Rotas e o novo Middleware ---
const authRoutes = require('./routes/authRoutes');
const companyRoutes = require('./routes/companyRoutes');
const { protect } = require('./middleware/authMiddleware'); // Importa nosso porteiro
// Rotas de negócio
const clienteRoutes = require('./routes/clienteRoutes'); 
const agendamentoRoutes = require('./routes/agendamentoRoutes');
const transacaoRoutes = require('./routes/transacaoRoutes');
const profissionalRoutes = require('./routes/profissionalRoutes');
const userRoutes = require('./routes/userRoutes');

// --- ROTAS PÚBLICAS (NÃO PRECISAM DE LOGIN) ---
app.use('/api/auth', authRoutes); // Login, Logout, Registro
app.use('/api/companies', companyRoutes); // Registro de novas empresas
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/register.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'register.html')));
app.get('/register-company.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'register-company.html')));
// Futuramente, a página de registro de empresa ficará aqui

// --- APLICAÇÃO DO PORTEIRO ---
// Tudo o que for definido ABAIXO desta linha, exigirá login.
app.use(protect);

// --- ROTAS PROTEGIDAS (PRECISAM DE LOGIN E FILTRAM POR COMPANYID) ---
app.use('/api/clientes', clienteRoutes); 
app.use('/api/agendamentos', agendamentoRoutes);
app.use('/api/transacoes', transacaoRoutes);
app.use('/api/profissionais', profissionalRoutes);
app.use('/api/users', userRoutes);

// Servir as páginas HTML protegidas
app.get('/dashboard.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'dashboard.html')));
app.get('/clientes.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'clientes.html')));
app.get('/agendamentos.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'agendamentos.html')));
app.get('/livro-caixa.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'livro-caixa.html')));
app.get('/relatorios.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'relatorios.html')));
app.get('/profissionais.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'profissionais.html')));
app.get('/gerenciar-usuarios.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'gerenciar-usuarios.html')));

// Iniciar o servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor a correr em http://localhost:${PORT}`);
});