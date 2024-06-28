const sqlite3 = require('sqlite3').verbose();

// Conectar a la base de datos SQLite (crear database.db si no existe)
let db = new sqlite3.Database('./database.db');

// Crear y configurar la tabla de datos
db.serialize(() => {
    // Borrar la tabla data si existe (para recrearla con el nuevo formato)
    db.run(`DROP TABLE IF EXISTS data`, (err) => {
        if (err) {
            console.error('Error al eliminar la tabla data:', err.message);
        } else {
            console.log('Tabla data eliminada correctamente');
        }
    });

    // Crear la tabla data
    db.run(`CREATE TABLE IF NOT EXISTS data (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        categoria TEXT,
        nombre TEXT,
        descripcion TEXT,
        link TEXT,
        vigencia TEXT
    )`, (err) => {
        if (err) {
            console.error('Error al crear la tabla data:', err.message);
        } else {
            console.log('Tabla data creada correctamente');
        }
    });

    // Insertar datos de ejemplo
    const datos = [
        { categoria: 'Compras', nombre: 'Comparaciones Variante Copia N', descripcion: 'Controlar Unidades-Facturacion-Tickets Por categorias subcategorias Marcas y laboratorios', link: 'Link', vigencia: 'Vigente' },
        { categoria: 'Ventas', nombre: 'Completo Turnero 1.0', descripcion: 'Analisis de Venta de sucursales y empleados por zona horaria y tipo de venta', link: 'Link', vigencia: 'Vigente' },
        { categoria: 'Ventas', nombre: 'Completo Convenios 1.0', descripcion: 'Analisis de Venta de Convenios-Cantidad de empleados asociados y cuanto uso tuvo el beneficio del convenio', link: 'Link', vigencia: 'Vigente' },
        { categoria: 'Stock', nombre: 'Stock 1.1', descripcion: 'Stock De sucursales Quiebres y movimientos en si por sucursal', link: 'Link', vigencia: 'En Proceso' },
        { categoria: 'Ventas', nombre: 'Completo Analisis', descripcion: 'Compras sobre ventas - Mal Entregados,Cajas y pendientes', link: 'Link', vigencia: 'En revision' },
        { categoria: 'Ventas', nombre: 'Eccomerce 1.0', descripcion: 'Analisis de Venta de sucursales y empleados por zona horaria y tipo de venta para las ventas de Eccomerce', link: 'Link', vigencia: 'En Proceso' },
        { categoria: 'Ventas', nombre: 'Ventas Call 1.0', descripcion: 'Analisis de Venta de sucursales y empleados por zona horaria y tipo de venta para las ventas de Eccomerce', link: 'Link', vigencia: 'En Proceso' },
        { categoria: 'Ventas', nombre: 'Medicos 1.0', descripcion: 'Ver Avance de obras sociales por recetas y venta sumado a rendimiento de los medicos, monodrogas y laboratorios', link: 'Link', vigencia: 'En revision' },
    ];

    // Insertar cada dato en la tabla
    datos.forEach(dato => {
        db.run('INSERT INTO data (categoria, nombre, descripcion, link, vigencia) VALUES (?, ?, ?, ?, ?)',
            [dato.categoria, dato.nombre, dato.descripcion, dato.link, dato.vigencia],
            (err) => {
                if (err) {
                    console.error(`Error al insertar dato ${dato.nombre}:`, err.message);
                } else {
                    console.log(`Dato ${dato.nombre} insertado correctamente`);
                }
            }
        );
    });
});

// Cerrar la conexión a la base de datos
db.close((err) => {
    if (err) {
        console.error('Error al cerrar la conexión a la base de datos:', err.message);
    } else {
        console.log('Conexión a la base de datos cerrada correctamente');
    }
});
