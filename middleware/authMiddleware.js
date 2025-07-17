// middleware/authMiddleware.js

const jwt = require('jsonwebtoken');

const protect = (req, res, next) => {
    // 1. Tenta obter o token do cabeçalho Authorization
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1]; // Pega a string do token após "Bearer "
    }
    // Se não encontrar no cabeçalho, tenta dos cookies (para compatibilidade ou casos específicos)
    if (!token && req.cookies && req.cookies.token) {
        token = req.cookies.token;
    }

    if (!token) {
        // Se não houver token em nenhum lugar
        console.log("Token não fornecido. Tentativa de acesso não autorizado.");
        if (req.originalUrl.startsWith('/api')) {
            return res.status(401).json({ message: 'Não autorizado, token não fornecido.' });
        }
        return res.redirect('/index.html');
    }

    try {
        // Verifica se o token é válido e decodifica
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Adiciona os dados do usuário (incluindo o companyId) ao objeto de requisição
        req.user = decoded; 

        // Permite o acesso à próxima rota
        next();
    } catch (error) {
        // Se o token for inválido, manda para o login
        console.error("Token inválido ou expirado:", error.message); // Log mais específico
        if (req.originalUrl.startsWith('/api')) {
            // Para chamadas de API, retorne 401
            return res.status(401).json({ message: 'Não autorizado, token inválido ou expirado.' });
        }
        // Para requisições de página, redirecione
        return res.redirect('/index.html');
    }
};

module.exports = { protect };