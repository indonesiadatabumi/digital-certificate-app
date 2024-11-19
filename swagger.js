const swaggerJsDoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const swaggerOptions = {
    swaggerDefinition: {
        openapi: '3.0.0',
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                },
            },
        },
        security: [{ bearerAuth: [] }],
        info: {
            title: 'Digital Certificate API',
            version: '1.0.0',
            description: 'API for managing digital certificates',
            contact: {
                name: 'Developer',
                email: 'developer@example.com',
            },
        },
        servers: [
            {
                url: `http://localhost:${process.env.PORT}`,
                description: 'Development server',
            },
        ],
    },
    apis: ['./routes/*.js'], // Points to your route files
};

const swaggerDocs = swaggerJsDoc(swaggerOptions);

module.exports = {
    swaggerUi,
    swaggerDocs,
};
