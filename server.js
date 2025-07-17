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
const Agendamento = require('./models/Agendamento'); 
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
const profissionalRoutes = require('./routes/profissionaisRoutes'); // Certifique-se que o nome do arquivo é correto
const userRoutes = require('./routes/userRoutes');

// --- ROTAS PÚBLICAS (NÃO PRECISAM DE LOGIN NEM DE 'protect') ---
app.use('/api/auth', authRoutes); 
app.use('/api/companies', companyRoutes); 
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html'))); 
app.get('/register.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'register.html')));
app.get('/register-company.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'register-company.html')));

// --- ROTAS PROTEGIDAS (APLIQUE O 'protect' DIRETAMENTE AQUI) ---
// Adicionando a rota /api/dashboard que estava faltando
app.get('/api/dashboard', protect, async (req, res) => { //
    try {
        const companyId = req.user.companyId; 

        if (!companyId) {
            console.error("Erro /api/dashboard: companyId não encontrado em req.user após protect."); //
            return res.status(401).json({ message: "Não autorizado: companyId ausente." }); //
        }

        const totalClientes = await Cliente.countDocuments({ companyId: companyId }); //

        const hoje = new Date();
        hoje.setUTCHours(0, 0, 0, 0); 
        const amanha = new Date(hoje);
        amanha.setUTCDate(hoje.getUTCDate() + 1); 

        const agendamentosHoje = await Agendamento.countDocuments({ //
            companyId: companyId,
            dataAgendamento: { $gte: hoje, $lt: amanha }
        });

        const proximoAgendamento = await Agendamento.findOne({ //
            companyId: companyId,
            dataAgendamento: { $gte: new Date() } 
        }).populate('cliente', 'nome').sort({ dataAgendamento: 1 }).limit(1);

        const inicioMes = new Date();
        inicioMes.setUTCFullYear(inicioMes.getUTCFullYear());
        inicioMes.setUTCMonth(inicioMes.getUTCMonth(), 1);
        inicioMes.setUTCHours(0, 0, 0, 0);

        const fimMes = new Date();
        fimMes.setUTCFullYear(fimMes.getUTCFullYear());
        fimMes.setUTCMonth(fimMes.getUTCMonth() + 1, 0); 
        fimMes.setUTCHours(23, 59, 59, 999);

        const receitaMesAgendamentos = await Agendamento.aggregate([ //
            { $match: { 
                companyId: companyId,
                status: 'Concluído',
                dataAgendamento: { $gte: inicioMes, $lte: fimMes }
            }},
            { $group: {
                _id: null,
                total: { $sum: "$valorTotal" }
            }}
        ]);

        const receitaMesTransacoes = await Transacao.aggregate([ //
            { $match: { 
                companyId: companyId,
                tipo: 'Receita',
                data: { $gte: inicioMes, $lte: fimMes }
            }},
            { $group: {
                _id: null,
                total: { $sum: "$valor" }
            }}
        ]);
        
        const totalReceitaMes = (receitaMesAgendamentos.length > 0 ? receitaMesAgendamentos[0].total : 0) + 
                              (receitaMesTransacoes.length > 0 ? receitaMesTransacoes[0].total : 0);

        const recentActivity = await Agendamento.find({ companyId: companyId }) //
            .populate('cliente', 'nome')
            .sort({ updatedAt: -1 }) 
            .limit(5)
            .select('cliente procedimentos status dataAgendamento'); 

        const formattedRecentActivity = recentActivity.map(ag => ({ //
            description: `Agendamento de ${ag.cliente ? ag.cliente.nome : 'N/A'} - ${ag.procedimentos.map(p => p.nome).join(', ')} (${ag.status})`,
            timestamp: ag.updatedAt 
        }));

        res.status(200).json({ //
            totalClientes,
            agendamentosHoje,
            proximoAgendamento: proximoAgendamento,
            receitaMes: totalReceitaMes,
            recentActivity: formattedRecentActivity
        });
    } catch (error) {
        console.error("Erro ao buscar dados do dashboard no backend:", error); //
        res.status(500).json({ message: "Erro interno do servidor ao buscar dados do dashboard." }); //
    }
});

app.use('/api/clientes', protect, clienteRoutes); 
app.use('/api/agendamentos', protect, agendamentoRoutes);
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