const express = require('express');
const session = require('express-session');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const Swal = require('sweetalert2');

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

// Conectar a la base de datos SQLite
let db = new sqlite3.Database('./database.db'); // Conectar a la base de datos database.db

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
        db.get('SELECT isAdmin FROM users WHERE id = ?', [req.session.userId], (err, user) => {
            if (err) {
                throw err;
            }
            if (user && user.isAdmin === 1) {
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
    db.all(query, params, (err, rows) => {
        if (err) {
            throw err;
        }
        const isAdmin = req.session.isAdmin === 1; // Verificar si el usuario es administrador
        res.render('index', { data: rows, isAdmin });
    });
});

app.get('/edit/:id', requireAdmin, (req, res) => {
    const id = req.params.id;
    db.get('SELECT * FROM data WHERE id = ?', [id], (err, row) => {
        if (err) {
            throw err;
        }
        res.render('edit', { item: row });
    });
});

app.post('/edit/:id', requireAdmin, (req, res) => {
    const id = req.params.id;
    const { categoria, nombre, descripcion, link, vigencia } = req.body;
    db.run('UPDATE data SET categoria = ?, nombre = ?, descripcion = ?, link = ?, vigencia = ? WHERE id = ?', [categoria, nombre, descripcion, link, vigencia, id], (err) => {
        if (err) {
            throw err;
        }
        res.redirect('/');
    });
});

app.get('/new', requireAdmin, (req, res) => {
    res.render('new');
});

app.post('/new', requireAdmin, (req, res) => {
    const { categoria, nombre, descripcion, link, vigencia } = req.body;
    db.run('INSERT INTO data (categoria, nombre, descripcion, link, vigencia) VALUES (?, ?, ?, ?, ?)', [categoria, nombre, descripcion, link, vigencia], (err) => {
        if (err) {
            throw err;
        }
        res.redirect('/');
    });
});

app.get('/login', (req, res) => {
    const query = 'SELECT id, username FROM users';
    db.all(query, [], (err, rows) => {
        if (err) {
            console.error('Error al ejecutar la consulta:', err);
            res.status(500).send('Error al obtener los nombres de usuario');
        } else {
            res.render('login', { users: rows });

        }
    });
});
app.post('/login', (req, res) => {
    const { username, password } = req.body;
    db.get('SELECT * FROM users WHERE username = ? AND password = ?', [username, password], (err, user) => {
        if (err) {
            throw err;
        }
        if (user) {
            req.session.userId = user.id; // Almacenar el ID del usuario en la sesión
            req.session.isAdmin = user.isAdmin; // Almacenar si el usuario es administrador en la sesión
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
    db.all('SELECT DISTINCT categoria FROM data', (err, categories) => {
        if (err) {
            throw err;
        }
        // Obtener todos los usuarios y sus roles
        db.all('SELECT id, username, roles FROM users', (err, users) => {
            if (err) {
                throw err;
            }
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
            res.render('admin_roles', { users, categories, successMessage: req.session.successMessage });
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
    db.run('UPDATE users SET roles = ? WHERE id = ?', [rolesString, userId], (err) => {
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

