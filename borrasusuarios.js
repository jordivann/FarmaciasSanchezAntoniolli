const sqlite3 = require('sqlite3').verbose();

// Conectar a la base de datos SQLite
let db = new sqlite3.Database('./database.db');

// Query para eliminar la tabla usuarios
const query = `DROP TABLE IF EXISTS users`;

// Ejecutar la consulta para eliminar la tabla
db.run(query, (err) => {
    if (err) {
        console.error('Error al eliminar la tabla de usuarios:', err.message);
    } else {
        console.log('Tabla de usuarios eliminada correctamente');
    }

    // Cerrar la conexión a la base de datos
    db.close((err) => {
        if (err) {
            console.error('Error al cerrar la conexión a la base de datos:', err.message);
        } else {
            console.log('Conexión a la base de datos cerrada correctamente');
        }
    });
});
