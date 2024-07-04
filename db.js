const { Client } = require('pg');
const dotenv = require('dotenv');

// Cargar variables de entorno desde el archivo .env
dotenv.config();

// Configurar conexión a PostgreSQL
const pgClient = new Client({
    connectionString: process.env.DATABASE_URL,
});

pgClient.connect((err) => {
    if (err) {
        console.error('Error al conectar a PostgreSQL:', err.stack);
    } else {
        console.log('Conectado a la base de datos PostgreSQL.');
    }
});

module.exports = pgClient;
