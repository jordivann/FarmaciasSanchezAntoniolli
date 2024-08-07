const express = require('express');
const session = require('express-session');
const { Client } = require('pg');
const bodyParser = require('body-parser');
const Swal = require('sweetalert2');
const dotenv = require('dotenv');
const pgClient = require('./db'); // Importar la configuración de la base de datos
const bcrypt = require('bcrypt');




dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Configuración de SweetAlert2
const SwalMixin = Swal.mixin({
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 3000,
    timerProgressBar: true,
    didOpen: (toast) => {
        toast.addEventListener('mouseenter', Swal.stopTimer);
        toast.addEventListener('mouseleave', Swal.resumeTimer);
    }
});

// Configurar middleware
app.set('view engine', 'ejs'); // Motor de plantillas EJS
app.use(express.static('public')); // Carpeta para archivos estáticos
app.use(bodyParser.urlencoded({ extended: true })); // Parsear body de las peticiones POST

// Configurar middleware para manejar sesiones
app.use(session({
    secret: 'secret-key', // Cambiar por una clave segura en producción
    resave: false,
    saveUninitialized: true,
}));

// Configurar conexión a PostgreSQL
// Configurar conexión a PostgreSQL


// Middleware para verificar si el usuario está autenticado
function requireLogin(req, res, next) {
    if (req.session.userId) {
        next(); // Permitir acceso si el usuario está autenticado
    } else {
        res.redirect('/login'); // Redirigir al inicio de sesión si no hay sesión activa
    }
}

// Middleware para verificar si el usuario es administrador
function requireAdmin(req, res, next) {
    if (req.session.userId) {
        pgClient.query('SELECT isadmin FROM users WHERE id = $1', [req.session.userId], (err, result) => {
            if (err) {
                throw err;
            }
            const user = result.rows[0];
            if (user && user.isadmin === true) {
                next(); // Permitir acceso si es administrador
            } else {
                res.send('Acceso denegado');
            }
        });
    } else {
        res.redirect('/login'); // Redirigir al inicio de sesión si no hay sesión activa
    }
}

// Rutas
app.get('/', requireLogin, (req, res) => {
    let query = 'SELECT * FROM data';
    let params = [];
    if (!req.session.isAdmin) {
        const roles = req.session.roles.map(role => `'${role.trim()}'`).join(',');
        query += ` WHERE categoria IN (${roles})`;
    }
    pgClient.query(query, params, (err, result) => {
        if (err) {
            throw err;
        }
        const isAdmin = req.session.isAdmin === true; // Verificar si el usuario es administrador
        res.render('index', { data: result.rows, isAdmin });
    });
});


app.get('/edit/:id', requireAdmin, (req, res) => {
    const id = req.params.id;
    const isAdmin = req.session.isAdmin === true;
    pgClient.query('SELECT * FROM data WHERE id = $1', [id], (err, result) => {
        if (err) {
            throw err;
        }
        
        res.render('edit', { item: result.rows[0] ,isAdmin});
    });
});

app.post('/edit/:id', requireAdmin, (req, res) => {
    const id = req.params.id;
    const { categoria, nombre, descripcion, link, vigencia } = req.body;
    pgClient.query('UPDATE data SET categoria = $1, nombre = $2, descripcion = $3, link = $4, vigencia = $5 WHERE id = $6', [categoria, nombre, descripcion, link, vigencia, id], (err) => {
        if (err) {
            throw err;
        }
        res.redirect('/');
    });
});
// Ruta para eliminar un elemento (POST)
app.post('/delete/:id', requireAdmin, (req, res) => {
    const id = req.params.id;
    pgClient.query('DELETE FROM data WHERE id = $1', [id], (err, result) => {
        if (err) {
            console.error('Error al eliminar el registro:', err);
            return res.status(500).send('Error al eliminar el registro');
        }
        
        if (result.rowCount === 0) {
            return res.status(404).send('Registro no encontrado');
        }
        
        res.status(200).send('Registro eliminado correctamente');
    });
});


// Ruta para mostrar el listado de usuarios
app.get('/users', requireAdmin, (req, res) => {
    pgClient.query('SELECT id, username, isadmin FROM users ORDER BY id ASC', (err, result) => {
        if (err) {
            console.error('Error al obtener usuarios:', err);
            res.status(500).send('Error al obtener usuarios');
        } else {
            const users = result.rows;
            const isAdmin = req.session.isAdmin === true;
            res.render('users_index', { users, isAdmin});
        }
    });
});


// Define la ruta para mostrar el formulario de nuevo usuario
app.get('/users/new', requireAdmin, (req, res) => {
    // Verifica si el usuario actual es administrador
    if (req.session.isAdmin) {
        const isAdmin = req.session.isAdmin === true;
        res.render('new_user', {isAdmin}); // Renderiza la vista EJS para agregar nuevo usuario
    } else {
        res.status(403).send('Acceso denegado'); // Si no es administrador, devuelve un error 403
    }
});

//Nuevo Usuario

app.post('/users/new', async (req, res) => {
    const { username, password, email } = req.body;
    let { isAdmin } = req.body;

    // Asegúrate de que isAdmin tenga un valor predeterminado de false si no está presente en la solicitud
    if (isAdmin === undefined) {
        isAdmin = false;
    }

    try {
        if (!password) {
            return res.status(400).send('Debe proporcionar una contraseña');
        }

        const query = `
            INSERT INTO users (username, password, isAdmin, email)
            VALUES ($1, $2, $3, $4)
            RETURNING *
        `;
        const values = [username, password, isAdmin, email];

        const result = await pgClient.query(query, values);

        res.redirect('/admin_roles');
    } catch (err) {
        console.error('Error al agregar usuario:', err);
        res.status(500).send('Error al agregar usuario');
    }
});





// Ruta para cargar el formulario de edición de usuario
app.get('/edit_user/:id', requireAdmin, async (req, res) => {
    const userId = req.params.id;

    try {
        const query = 'SELECT id, username, password, isAdmin FROM users WHERE id = $1';
        const { rows } = await pgClient.query(query, [userId]);

        if (rows.length === 0) {
            return res.status(404).send('Usuario no encontrado');
        }

        const user = rows[0];
        const isAdmin = req.session.isAdmin === true;
        res.render('edit_user', { user, isAdmin }); // Renderiza el formulario de edición con los datos del usuario
    } catch (err) {
        console.error('Error al cargar formulario de edición:', err);
        res.status(500).send('Error al cargar formulario de edición');
    }
});



// Ruta para editar usuario
// Ruta para editar usuario sin encriptar la contraseña
app.post('/edit_user/:id', async (req, res) => {
    const userId = req.params.id;
    const { username, password, isAdmin } = req.body;

    try {
        let query, values;
        if (password) {
            // Actualizar con nueva contraseña
            query = 'UPDATE users SET username = $1, password = $2, isAdmin = $3 WHERE id = $4 RETURNING *';
            values = [username, password, isAdmin, userId];
        } else {
            // Actualizar sin cambiar la contraseña
            query = 'UPDATE users SET username = $1, isAdmin = $2 WHERE id = $3 RETURNING *';
            values = [username, isAdmin, userId];
        }

        const { rows } = await pgClient.query(query, values);
        if (rows.length === 0) {
            return res.status(404).send('Usuario no encontrado');
        }

        res.redirect('/'); // Redirige después de editar
    } catch (err) {
        console.error('Error al editar usuario:', err);
        res.status(500).send('Error al editar usuario');
    }
});




app.get('/new', requireAdmin, (req, res) => {
    
    const isAdmin = req.session.isAdmin === true;
    res.render('new', {isAdmin});
});

app.post('/new', requireAdmin, (req, res) => {
    const { categoria, nombre, descripcion, link, vigencia } = req.body;
    pgClient.query('INSERT INTO data (categoria, nombre, descripcion, link, vigencia) VALUES ($1, $2, $3, $4, $5)', [categoria, nombre, descripcion, link, vigencia], (err) => {
        if (err) {
            throw err;
        }
        res.redirect('/');
    });
});
// Ruta para eliminar un elemento
app.post('/delete/:id', async (req, res) => {
    const itemId = req.params.id;

    try {
        const query = 'DELETE FROM items WHERE id = $1 RETURNING *';
        const { rows } = await pool.query(query, [itemId]);

        if (rows.length === 0) {
            return res.status(404).send('Registro no encontrado');
        }

        // Redirigir o enviar una respuesta de éxito
        res.redirect('/'); // O ajusta la redirección según sea necesario
    } catch (err) {
        console.error('Error al eliminar el registro:', err);
        res.status(500).send('Error al eliminar el registro');
    }
});
app.get('/login', (req, res) => {
    const query = 'SELECT id, username FROM users';
    pgClient.query(query, [], (err, result) => {
        if (err) {
            console.error('Error al ejecutar la consulta:', err);
            res.status(500).send('Error al obtener los nombres de usuario');
        } else {
            
            const isAdmin = req.session.isAdmin === true;
            res.render('login', { users: result.rows, isAdmin });
        }
    });
});

app.post('/login', (req, res) => {
    const { username, password } = req.body;
    pgClient.query('SELECT * FROM users WHERE username = $1 AND password = $2', [username, password], (err, result) => {
        if (err) {
            throw err;
        }
        const user = result.rows[0];
        if (user) {
            req.session.userId = user.id; // Almacenar el ID del usuario en la sesión
            req.session.isAdmin = user.isadmin; // Almacenar si el usuario es administrador en la sesión
            req.session.roles = user.roles ? user.roles.split(',') : []; // Verificar y dividir los roles si existen
            res.redirect('/');
        } else {
            res.redirect('/login');
        }
    });
});

app.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error(err);
        }
        res.redirect('/');
    });
});
app.get('/admin_roles', requireAdmin, (req, res) => {
    // Obtener todas las categorías disponibles desde la tabla 'data'
    pgClient.query('SELECT DISTINCT categoria FROM data', (err, resultCategories) => {
        if (err) {
            throw err;
        }
        const categories = resultCategories.rows;
        // Obtener todos los usuarios y sus roles
        pgClient.query('SELECT id, username, roles FROM users', (err, resultUsers) => {
            if (err) {
                throw err;
            }
            const users = resultUsers.rows;
            // Convertir roles de string separado por comas a array
            users.forEach(user => {
                if (user.roles) {
                    user.roles = user.roles.split(',').map(role => role.trim());
                } else {
                    user.roles = []; // Si no hay roles, inicializar como array vacío
                }
                user.rolesText = user.roles.join(', '); // Crear rolesText para mostrar en la vista
            });
            // Renderizar la vista 'admin_roles' con los usuarios y categorías obtenidos
            
            const isAdmin = req.session.isAdmin === true;
            res.render('admin_roles', { users, categories, successMessage: req.session.successMessage, isAdmin });
            // Limpiar el mensaje de éxito después de mostrarlo una vez
            req.session.successMessage = null;
        });
    });
});



// Ruta para modificar roles de usuarios
app.post('/admin_roles/update', requireAdmin, (req, res) => {
    const { userId, newRoles } = req.body;

    // Verificar si newRoles es un array y procesarlo correctamente
    let rolesString;
    if (Array.isArray(newRoles)) {
        rolesString = newRoles.join(',');
    } else if (typeof newRoles === 'string') {
        rolesString = newRoles;
    } else {
        rolesString = ''; // Manejar el caso donde no se seleccionaron roles
    }

    // Ejemplo de actualización en la base de datos
    pgClient.query('UPDATE users SET roles = $1 WHERE id = $2', [rolesString, userId], (err) => {
        if (err) {
            throw err;
        }
        // Configurar el mensaje de éxito en la sesión para mostrarlo en la próxima carga de página
        req.session.successMessage = 'Roles actualizados correctamente';
        res.redirect('/admin_roles');
    });
});

// Middleware para agregar información de autenticación a las vistas
app.use((req, res, next) => {
    res.locals.isAuthenticated = !!req.session.userId;
    next();
});

// Iniciar el servidor
app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
