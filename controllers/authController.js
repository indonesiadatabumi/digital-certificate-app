const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const knexInstance = require('../knex');

const SECRET_KEY = process.env.JWT_SECRET;

exports.register = async (req, res) => {
    const { name, email, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);

    try {
        const [id] = await knexInstance('users').insert({ name, email, password: hashedPassword }).returning('id');
        res.status(201).json({ message: 'User registered', userId: id });
    } catch (error) {
        res.status(400).json({ error: 'Registration failed' });
    }
};

exports.login = async (req, res) => {
    const { email, password } = req.body;

    try {
        const user = await knexInstance('users').where({ email }).first();
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const token = jwt.sign({ id: user.id }, SECRET_KEY);
        res.status(200).json({ message: 'Login successful', token });
    } catch (error) {
        res.status(500).json({ error: 'Login failed' });
    }
};
