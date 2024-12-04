const multer = require('multer');
const path = require('path');
const fs = require('fs');
const nodemailer = require('nodemailer');
const bodyParser = require('body-parser');
const PDFDocument = require('pdfkit');
const knexInstance = require('../knex');
const sharp = require("sharp");
const Tesseract = require("tesseract.js");
const { createCanvas, loadImage } = require("canvas");
const gm = require('gm').subClass({ imageMagick: true });


const imagePath = path.resolve(process.cwd(), "templates", "certificate-template.jpg");


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

        // const filePath = path.join(process.cwd(), 'uploads', cert.filename);
        res.download(cert.filename);
    } catch (error) {
        res.status(500).json({ error: 'Download failed' });
    }
};


exports.generateCertificate = async (req, res) => {
    const { certifiedText } = req.body;
    const memberName = req.user.name;
    const email = req.user.email;

    const transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 587,
        auth: {
            user: 'indonesiadatabumi@gmail.com',
            pass: 'cvlv cbjo jrqf hcrk',
        },
    });

    if (!memberName || !certifiedText || !email) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
        const filePath = await generate(memberName, certifiedText);
        // const filePath = await genCertificate(memberName, certifiedText);

        const result = await knexInstance('certificates').insert({ user_id: req.user.id, filename: filePath, activity_name: certifiedText }).returning('id');
        console.log(result);

        const certificateId = result[0].id;

        const mailOptions = {
            from: 'indonesiadatabumi@gmail.com',
            to: email,
            subject: 'Your Certificate',
            text: `Dear ${memberName},\n\nPlease find attached your certificate for "${certifiedText}".\n\nBest regards,\nYour Team`,
            attachments: [
                {
                    filename: path.basename(filePath),
                    path: filePath,
                },
            ],
        };

        await transporter.sendMail(mailOptions);

        return res.status(201).json({
            message: 'Certificate generated and emailed successfully',
            certificateId,
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: `Failed to generate certificate ${error}` });
    }
};

const generate = async (memberName) => {
    const textData = [
        {
            x: 118, // X-coordinate of the bounding box
            y: 508, // Y-coordinate of the bounding box
            width: 813, // Width of the bounding box
            height: 140, // Height of the bounding box
            text: memberName, // Text to display
            font: '1124px Arial', // Font size and style
            textColor: '#000000' // Black text color
        }
    ];

    return await addTextWithBoundingBox(imagePath, textData, memberName);

    // return await modifyImage(imagePath, detectedText, modifications, memberName);
}

const genCertificate = async (memberName, certifiedText) => {
    const templatePath = path.join(process.cwd(), "templates", "certificate-template.jpg");
    const outputPath = path.join(process.cwd(), "uploads", `${memberName}-${certifiedText}.jpg`);


    const uploadsDir = path.join(process.cwd(), "uploads");
    if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir);
    }

    // Validate template path
    if (!fs.existsSync(templatePath)) {
        throw new Error(`Template file not found: ${templatePath}`);
    }

    // Generate certificate using Sharp
    try {
        await sharp(templatePath)
            .composite([
                {
                    input: Buffer.from(
                        `<svg width="1600" height="1131">
                            <style>
                                .activityName { fill: green; font-size: 80px; font-weight: bold; }
                                .to { fill: black; font-size: 10px; }
                                .name { fill: black; font-size: 100px; }
                            </style>
                            <text x="100" y="300" class="activityName">${certifiedText}</text>
                            <text x="100" y="350" class="to">DIPERSEMBAHKAN KEPADA</text>
                            <text x="100" y="480" class="name">${memberName}</text>
                        </svg>`
                    ),
                    blend: "over",
                },
            ])
            .toFile(outputPath);

        return outputPath;
    } catch (error) {
        console.error("Error generating certificate:", error);
        throw new Error("Failed to generate certificate");
    }
};


async function detectText(imagePath) {
    try {
        const result = await Tesseract.recognize(imagePath, "eng", {
            logger: (info) => console.log(info), // Optional: Log OCR process
        });

        // Log the detected text and bounding boxes
        const boxes = result.data.words.map((word) => ({
            text: word.text,
            boundingBox: word.bbox,
        }));

        console.log("Detected Text Positions:", boxes);
        return boxes;
    } catch (error) {
        console.error("Error detecting text:", error);
    }
}
function fitTextToBox(ctx, text, maxWidth, maxHeight) {
    let fontSize = 10; // Starting font size
    let textWidth, textHeight;

    do {
        ctx.font = `${fontSize}px Arial`;  // Update font size
        textWidth = ctx.measureText(text).width;
        textHeight = fontSize;  // Roughly estimate height from font size
        fontSize++;
        console.log(`fontSize ${fontSize}`);
    } while (textWidth < maxWidth && textHeight < maxHeight);

    ctx.font = `${fontSize - 1}px Arial`; // Use the last fitting size
}

async function addTextWithBoundingBox(imagePath, textData, memberName) {
    try {
        const timestamp = Math.floor(Date.now() / 1000);
        let fileMemberName = memberName.replace(/\s+/g, '')+"-"+timestamp;
        const outputPath = path.join(process.cwd(), "uploads", `${fileMemberName}.jpg`);
        gm(imagePath)
            .font('Arial', 48)  // Font and size
            .fill('#003366')    // Text color (dark blue)
            .drawText(118, 38, memberName, 'West')  // Text, positioning relative to center
            .write(outputPath, (err) => {
                if (err) console.error('Error:', err);
                else console.log('Certificate generated successfully:', outputPath);
            });
        return outputPath;
    } catch (error) {
        return undefined;
    }
}