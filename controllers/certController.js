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

        const filePath = path.join(process.cwd(), '../uploads', cert.filename);
        res.download(filePath);
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
            pass: 'Dbi@2020',
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
        return res.status(500).json({ error: 'Failed to generate certificate' });
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

        // Load the image
        const image = await loadImage(imagePath);
        // Create a canvas with the image dimensions
        const canvas = createCanvas(image.width, image.height);
        const ctx = canvas.getContext('2d');

        // ctx.setTransform(1, 0, 0, 1, 0, 0);  // Reset scaling before drawing

        // Draw the image on the canvas
        ctx.drawImage(image, 0, 0);
        

        // Define the bounding box
        const box = {
            x: 118, // Top-left x-coordinate
            y: 508, // Top-left y-coordinate
            width: 826, // Box width
            height: 140, // Box height
        };

        // Text to render
        const text = memberName;

        // Start with a large font size and scale down

        // Dynamically adjust font size to fit text width in the box
        while (ctx.measureText(text).width > box.width && fontSize > 10) {
            fontSize--; // Decrease font size
            ctx.font = `${fontSize}px Arial`;
        }

        // Fill the bounding box (optional, for visualization)
        // ctx.fillStyle = 'rgba(0, 0, 0, 0)'; // Light transparent black
        // ctx.fillRect(box.x, box.y, box.width, box.height);
        // fitTextToBox(ctx, text, box.width, box.height);

        // Set text color and alignment
        ctx.fillStyle = 'white'; // Text color
        ctx.textAlign = 'left'; // Center align horizontally
        ctx.textBaseline = 'middle'; // Center align vertically

        // Calculate text position within the box
        const textX = box.x; // Center of the box (x-axis)
        const textY = box.y + (box.height / 2); //(box.y + box.height) / 2; // Center of the box (y-axis)
        // console.log(textX, textY);
        // let fontSize = box.y + box.height; // Maximum font size is the box height
        // let fontSize = 10000; // Maximum font size is the box height

        // ctx.quality = 'best'
        // ctx.font = '148px';  // Set a large font size
        // ctx.fillStyle = 'black';
        // ctx.strokeRect(box.x, box.y, box.width, box.height);
        // ctx.fillStyle = 'rgba(0, 0, 0, 0)';  // Black with 50% opacity
        // ctx.fillRect(box.x, box.y, box.width, box.height);         // Adjust position and size

        // ctx.strokeText(text, textX, textY, box.width);
        ctx.fillText(text, textX, textY, box.width);

        const outputPath = path.join(process.cwd(), "uploads", `${memberName}.jpg`);
        const out = fs.createWriteStream(outputPath);
        const stream = canvas.createJPEGStream();
        stream.pipe(out);

        out.on('finish', () => console.log(`Image saved to ${outputPath}`));

    } catch (error) {
        console.error('Error processing the image:', error);
    }

    // loadImage(imagePath).then((image) => {
    //     const canvas = createCanvas(image.width, image.height);
    //     const ctx = canvas.getContext('2d');
      
    //     // Draw the template image
    //     ctx.drawImage(image, 0, 0, image.width, image.height);
    //     ctx.setTransform(1, 0, 0, 1, 0, 0);

    //     ctx.font = 'bold 141px Arial';
    //     ctx.fillStyle = '#003366';
    //     ctx.textAlign = 'center';
      
    //     // Add the recipient's name
    //     // const recipientName = 'John Doe';  // Change dynamically per user
    //     ctx.fillText(memberName, canvas.width / 2, 330);  // Adjust Y position as needed
      
    //     // Add additional details
    //     ctx.font = '24px Arial';   // Smaller font for other text
    //     ctx.fillText('November 2024', canvas.width / 2, 460);  // Date position
      
    //     // Save the generated certificate
    //     const buffer = canvas.toBuffer('image/png');
    //     //     const outputPath = path.join(process.cwd(), "uploads", `${memberName}.jpg`);
    //     fs.writeFileSync('generated-certificate.png', buffer);
    //     console.log('Certificate generated successfully!');
    //   }).catch(err => console.error('Error loading image:', err));
}