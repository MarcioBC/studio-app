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
    origin: 'https://studio-app-j198.onrender.com', // Sua URL exata. Mantenha 'https://'
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

// --- Importar Modelos (necessários para a nova rota /api/dashboard) ---
const User = require('./models/User'); 
const Agendamento = require('./('./models/Agendamento'); // Corrigido o caminho
const Cliente = require('./models/Cliente'); 
const Transacao = require('./models/Transacao'); 
// --- Fim dos novos imports de Modelos ---

// --- Importar Rotas e o middleware de proteção ---
const authRoutes = require('./routes/authRoutes');
const companyRoutes = require('./routes/companyRoutes');
const { protect } = require('./middleware/authMiddleware'); 
// Rotas de negócio
const clienteRoutes = require('./routes/clienteRoutes'); 
const agendamentoRoutes = require('./routes/agendamentoRoutes');
const transacaoRoutes = require('./routes/transacaoRoutes');
const profissionalRoutes = require('./routes/profissionalRoutes'); // Nome do arquivo é 'profissionalRoutes.js'
const userRoutes = require('./routes/userRoutes');

// --- ROTAS PÚBLICAS (NÃO PRECISAM DE LOGIN NEM DE 'protect') ---
app.use('/api/auth', authRoutes); 
app.use('/api/companies', companyRoutes); 
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html'))); 
app.get('/register.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'register.html')));
app.get('/register-company.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'register-company.html')));

// --- ROTAS PROTEGIDAS (APLIQUE O 'protect' DIRETAMENTE AQUI) ---
// Adicionando a rota /api/dashboard que fornecerá TODOS os dados para o Dashboard HTML
app.get('/api/dashboard', protect, async (req, res) => {
    try {
        const companyId = req.user.companyId; 

        if (!companyId) {
            console.error("Erro /api/dashboard: companyId não encontrado em req.user após protect.");
            return res.status(401).json({ message: "Não autorizado: companyId ausente." });
        }

        // --- DADOS PARA OS CARDS DO DASHBOARD ---
        // Agendamentos de Hoje
        const hoje = new Date();
        hoje.setUTCHours(0, 0, 0, 0); 
        const amanha = new Date(hoje);
        amanha.setUTCDate(hoje.getUTCDate() + 1); 
        const agendamentosHojeCount = await Agendamento.countDocuments({
            companyId: companyId,
            dataAgendamento: { $gte: hoje, $lt: amanha }
        });

        // Agendamentos da Semana
        const inicioSemana = new Date(hoje); // Começa com hoje 00:00 UTC
        inicioSemana.setUTCDate(hoje.getUTCDate() - hoje.getUTCDay()); // Retrocede para o domingo (0 = domingo)
        const fimSemana = new Date(inicioSemana);
        fimSemana.setUTCDate(inicioSemana.getUTCDate() + 7); // Avança 7 dias para o próximo domingo 00:00 UTC
        const agendamentosSemanaCount = await Agendamento.countDocuments({
            companyId: companyId,
            dataAgendamento: { $gte: inicioSemana, $lt: fimSemana }
        });

        // Agendamentos Confirmados (total geral)
        const agendamentosConfirmadosCount = await Agendamento.countDocuments({
            companyId: companyId,
            status: 'Confirmado'
        });

        // Agendamentos Concluídos (total geral)
        const agendamentosConcluidosCount = await Agendamento.countDocuments({
            companyId: companyId,
            status: 'Concluído'
        });

        // --- LISTAGEM DOS AGENDAMENTOS DO DIA ---
        const agendamentosDoDiaList = await Agendamento.find({
            companyId: companyId,
            dataAgendamento: { $gte: hoje, $lt: amanha } // Usa a mesma lógica de hoje
        }).populate('cliente', 'nome').sort({ dataAgendamento: 1 }); // Popula o cliente para exibir o nome

        // --- ENVIA TODOS OS DADOS EM UMA ÚNICA RESPOSTA ---
        res.status(200).json({
            agendamentosHojeCount,
            agendamentosSemanaCount,
            agendamentosConfirmadosCount,
            agendamentosConcluidosCount,
            agendamentosDoDiaList
        });

    } catch (error) {
        console.error("Erro ao buscar dados do dashboard no backend:", error); 
        res.status(500).json({ message: "Erro interno do servidor ao buscar dados do dashboard." }); 
    }
});

// Rotas de API para as outras seções do sistema
app.use('/api/clientes', protect, clienteRoutes); 
app.use('/api/agendamentos', protect, agendamentoRoutes); // Note que este é para rotas como /api/agendamentos (GET ALL), /api/agendamentos/:id
app.use('/api/transacoes', protect, transacaoRoutes); 
app.use('/api/profissionais', protect, profissionalRoutes); 
app.use('/api/users', protect, userRoutes);

// Servir as páginas HTML protegidas
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