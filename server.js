// server.js

const express = require('express');
const mongoose = require('mongoose');
const cookieParser = require('cookie-parser');
const path = require('path');
require('dotenv').config();
const cors = require('cors'); // <--- ADICIONADO: Importa o módulo 'cors'

const app = express();

// --- CRÍTICO: CONFIGURAÇÃO DO CORS DEVE SER UMA DAS PRIMEIRAS COISAS ---
// PARA DEPURACAO, VAMOS USAR TEMPORARIAMENTE 'origin: *'
// ISSO ABRE O CORS PARA QUALQUER ORIGEM E DEVE ELIMINAR O PROBLEMA DE CORS.
// NUNCA DEIXE ISSO EM PRODUÇÃO FINAL.
app.use(cors({
    origin: '*', // <--- ALTERADO TEMPORARIAMENTE PARA PERMITIR QUALQUER ORIGEM
    credentials: true // Permite que o navegador envie e receba cookies (importante para sua autenticação JWT via cookie)
}));
// --- FIM DA ADIÇÃO DO CORS ---


// Middlewares built-in do Express (depois do CORS)
app.use(express.json()); // Para fazer o parsing de requisições JSON
app.use(express.urlencoded({ extended: true })); // Para fazer o parsing de requisições URL-encoded
app.use(cookieParser()); // Para fazer o parsing de cookies

// Servir arquivos estáticos (colocado aqui após os middlewares básicos para garantir que o CORS se aplique)
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

// --- ROTAS PÚBLICAS (NÃO PRECISAM DE LOGIN) ---
app.use('/api/auth', authRoutes); // Login, Logout, Registro
app.use('/api/companies', companyRoutes); // Registro de novas empresas (se a criação de empresa não exige login)
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/register.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'register.html')));
app.get('/register-company.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'register-company.html')));

// --- APLICAÇÃO DO PORTEIRO (Middleware de Autenticação) ---
// Tudo o que for definido ABAIXO desta linha, exigirá login.
app.use(protect); // protect é o middleware que verifica o token e popula req.user

// --- ROTAS PROTEGIDAS (PRECISAM DE LOGIN E FILTRAM POR COMPANYID) ---
app.use('/api/clientes', clienteRoutes); 
app.use('/api/agendamentos', agendamentoRoutes);
app.use('/api/transacoes', transacaoRoutes);
app.use('/api/profissionais', profissionalRoutes);
app.use('/api/users', userRoutes);

// Servir as páginas HTML protegidas (estas rotas HTML também serão protegidas por 'protect')
app.get('/dashboard.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'dashboard.html')));
app.get('/clientes.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'clientes.html')));
app.get('/agendamentos.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'agendamentos.html')));
app.get('/livro-caixa.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'livro-caixa.html')));
app.get('/relatorios.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'relatorios.html')));
app.get('/profissionais.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'profissionais.html')));
app.get('/gerenciar-usuarios.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'gerenciar-usuarios.html')));


// --- Manipulação de Erros (sempre no final) ---
// Captura de erros 404 (para rotas não encontradas)
app.use((req, res, next) => {
    res.status(404).send("Desculpe, não conseguimos encontrar isso!");
});

// Manipulador de erros genérico (para erros internos do servidor)
app.use((err, req, res, next) => {
    console.error(err.stack); // Registra o stack trace do erro no console do servidor
    res.status(500).send('Algo deu errado no servidor!'); // Envia uma resposta de erro genérica
});


// Iniciar o servidor
const PORT = process.env.PORT || 3000; // Usa a porta do ambiente (Render) ou 3000 como padrão
app.listen(PORT, () => {
    console.log(`Servidor a correr em http://localhost:${PORT}`);
    console.log("Aplicativo pronto para receber requisições!"); 
});