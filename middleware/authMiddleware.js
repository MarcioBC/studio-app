// middleware/authMiddleware.js

const jwt = require('jsonwebtoken');

const protect = (req, res, next) => {
    const token = req.cookies.token;

    if (token) {
        try {
            // Verifica se o token é válido e decodifica
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            
            // Adiciona os dados do usuário (incluindo o companyId) ao objeto de requisição
            req.user = decoded; 
            
            // Permite o acesso à próxima rota
            next();
        } catch (error) {
            // Se o token for inválido, manda para o login
            console.log("Token inválido, redirecionando para login.");
            return res.redirect('/index.html');
        }
    } else {
        // Se não houver token, verifica se é uma chamada de API ou uma página
        if (req.originalUrl.startsWith('/api')) {
             return res.status(401).json({ message: 'Não autorizado, token não fornecido.' });
        }
        // Se for uma tentativa de acessar uma página, manda para o login
        return res.redirect('/index.html');
    }
};

module.exports = { protect };