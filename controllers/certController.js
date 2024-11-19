const multer = require('multer');
const path = require('path');
const knexInstance = require('../knex');

const storage = multer.diskStorage({
    destination: './uploads/',
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname}`);
    },
});
exports.upload = multer({ storage });

exports.uploadCert = async (req, res) => {
    try {
        const { activityName } = req.body;
        const filename = req.file.filename;

        await knexInstance('certificates').insert({ user_id: req.user.id, filename, activity_name: activityName });
        res.status(200).json({ message: 'Certificate uploaded successfully' });
    } catch (error) {
        res.status(500).json({ error: `Upload failed ${error}` });
    }
};

exports.getCertificates = async (req, res) => {
    try {
        const certificates = await knexInstance('certificates').where({ user_id: req.user.id });
        res.status(200).json(certificates);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch certificates' });
    }
};

exports.downloadCert = async (req, res) => {
    const { id } = req.params;

    try {
        const cert = await knexInstance('certificates').where({ id, user_id: req.user.id }).first();
        if (!cert) return res.status(404).json({ error: 'Certificate not found' });

        const filePath = path.join(__dirname, '../uploads', cert.filename);
        res.download(filePath);
    } catch (error) {
        res.status(500).json({ error: 'Download failed' });
    }
};
