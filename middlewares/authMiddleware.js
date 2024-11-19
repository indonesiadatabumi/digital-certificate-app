// const jwt = require('jwt-simple');
const jwt = require('jsonwebtoken');

const knexInstance = require('../knex');
const SECRET_KEY = process.env.JWT_SECRET;

exports.authenticate = async (req, res, next) => {
    const tokenBearer = req.headers.authorization;
    if (!tokenBearer) return res.status(401).json({ error: 'Token missing' });

    try {
        let token = tokenBearer.split(" ")[1];        
        const decoded = jwt.verify(token, SECRET_KEY);
        console.log(`token ${token}, secretKey ${SECRET_KEY}, decoded ${decoded}`);
        const user = await knexInstance('users').where({ id: decoded.id }).first();
        if (!user) return res.status(401).json({ error: 'Invalid token' });

        req.user = user; // Attach user info to request object
        next();
    } catch (err) {
        res.status(401).json({ error: err });
    }
};
