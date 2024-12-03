/**
 * @swagger
 * tags:
 *   name: Certificates
 *   description: Certificate management
 */

/**
 * @swagger
 * /certificates/upload:
 *   post:
 *     summary: Upload a certificate
 *     tags: [Certificates]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               certificate:
 *                 type: string
 *                 format: binary
 *               activityName:
 *                 type: string
 *     responses:
 *       200:
 *         description: Certificate uploaded successfully
 *       500:
 *         description: Upload failed
 */

/**
 * @swagger
 * /certificates:
 *   get:
 *     summary: Get all certificates for the logged-in user
 *     tags: [Certificates]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of certificates
 *       500:
 *         description: Failed to fetch certificates
 */

/**
 * @swagger
 * /certificates/{id}/download:
 *   get:
 *     summary: Download a specific certificate
 *     tags: [Certificates]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Certificate downloaded
 *       404:
 *         description: Certificate not found
 */

/**
 * @swagger
 * /certificates/generate:
 *   post:
 *     summary: Generating Certificate
 *     tags: [Certificates]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - certifiedText
 *             properties:
 *               certifiedText:
 *                 type: string
 *     responses:
 *       200:
 *         description: Generate Successfully
 *       401:
 *         description: Invalid credentials
 */

const express = require('express');
const { uploadCert, getCertificates, downloadCert, upload, generateCertificate } = require('../controllers/certController');
const { authenticate } = require('../middlewares/authMiddleware');
const router = express.Router();

router.post('/upload', authenticate, upload.single('certificate'), uploadCert);
router.get('/', authenticate, getCertificates);
router.get('/:id/download', authenticate, downloadCert);
router.post('/generate', authenticate, generateCertificate);

module.exports = router;
