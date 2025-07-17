// server.js

const express = require('express');
const mongoose = require('mongoose');
const cookieParser = require('cookie-parser');
const path = require('path');
require('dotenv').config();
const cors = require('cors'); 

const app = express();

// --- CRÍTICO: CONFIGURAÇÃO DO CORS DEVE SER UMA DAS PRIMEIRAS COISAS ---
app.use(cors({
    origin: 'https://studio-app-j198.onrender.com', //
    credentials: true
}));
// --- FIM DA ADIÇÃO DO CORS ---


// Middlewares built-in do Express (depois do CORS)
app.use(express.json()); 
app.use(express.urlencoded({ extended: true })); 
app.use(cookieParser()); 

// Servir arquivos estáticos (colocado aqui após os middlewares básicos)
app.use(express.static('public')); 


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

// --- ROTAS PÚBLICAS (NÃO PRECISAM DE LOGIN NEM DE 'protect') ---
app.use('/api/auth', authRoutes); // Login, Logout, Registro
app.use('/api/companies', companyRoutes); // Registro de novas empresas (se a criação de empresa não exige login)
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html'))); // Página de Login
app.get('/register.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'register.html')));
app.get('/register-company.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'register-company.html')));

// --- REMOVIDA A LINHA 'app.use(protect);' GLOBAL AQUI (foi removida do seu código original) ---

// --- ROTAS PROTEGIDAS (APLIQUE O 'protect' DIRETAMENTE AQUI) ---
app.use('/api/clientes', protect, clienteRoutes); 
app.use('/api/agendamentos', protect, agendamentoRoutes);
app.use('/api/transacoes', protect, transacaoRoutes);
app.use('/api/profissionais', protect, profissionalRoutes);
app.use('/api/users', protect, userRoutes);

// Servir as páginas HTML protegidas (APLIQUE O 'protect' AQUI TAMBÉM)
app.get('/dashboard.html', protect, (req, res) => res.sendFile(path.join(__dirname, 'public', 'dashboard.html'))); 
app.get('/clientes.html', protect, (req, res) => res.sendFile(path.join(__dirname, 'public', 'clientes.html'))); 
app.get('/agendamentos.html', protect, (req, res) => res.sendFile(path.join(__dirname, 'public', 'agendamentos.html'))); 
app.get('/livro-caixa.html', protect, (req, res) => res.sendFile(path.join(__dirname, 'public', 'livro-caixa.html'))); 
app.get('/relatorios.html', protect, (req, res) => res.sendFile(path.join(__dirname, 'public', 'relatorios.html'))); 
app.get('/profissionais.html', protect, (req, res) => res.sendFile(path.join(__dirname, 'public', 'profissionais.html'))); 
app.get('/gerenciar-usuarios.html', protect, (req, res) => res.sendFile(path.join(__dirname, 'public', 'gerenciar-usuarios.html'))); 


// --- Manipulação de Erros (sempre no final) ---
app.use((req, res, next) => {
    res.status(404).send("Desculpe, não conseguimos encontrar isso!");
});

app.use((err, req, res, next) => {
    console.error(err.stack); 
    res.status(500).send('Algo deu errado no servidor!'); 
});


// Iniciar o servidor
const PORT = process.env.PORT || 3000; 
app.listen(PORT, () => {
    console.log(`Servidor a correr em http://localhost:${PORT}`);
    console.log("Aplicativo pronto para receber requisições!"); 
});