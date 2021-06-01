//DECLARACION DE LIBRERIAS/DEPENDENCIAS/MODULOS QUE VAMOS A UTILIZAR
const express= require ('express'), 
socket= require('socket.io'),
mysql= require('mysql'),
cookieParser= require('cookie-parser'),
session= require('express-session');

//DECLARAMOS APP, VARIABLE DE LA APPLICACION QUE TRABAJARÁ LAS RUTAS Y EL PUERTO DE NUESTRO SERVIDOR.
var app= express();

//DECLARAMOS LA VARIABLE server, QUE NOS NOTIFICARÁ CUANDO ARRANQUE NUESTRO SERVIDOR Y NOS DIRÁ EL PUERTO QUE ESTA UTILIZANDO.
var server= app.listen(3030, ()=>{
    console.log("Servidor trabajando en el puerto 3030");
})

//DECLARAMOS LA VARIABLE DONDE TRABAJAREMOS SOCKET.IO PARA CREAR LA CONEXIÓN/SESIÓN
var io= socket(server); 

//AHORA CREAMOS LA VARIABLE sessionMiddleware PARA ALMACENAR LOS DATOS DE LA SESION EN EL SERVIDOR, Y PARA RECIBIR LA REQUEST Y RESPONSE
var sessionMiddleware= session({
    secret: "keyUltraSecret",
    resave: true,
    saveUninitialized: true
})

//PARA QUE SOCKET IO UTILICE LOS DATOS DE LA SESION DE sessionMiddleware Y LOS DATOS DE REQUEST Y RESPONSE.
io.use(function(socket,next){
    sessionMiddleware(socket.request, socket.request.res, next);
})

//ESTABLECER MODULOS Y FUNCIONES QUE USARÁ APP
app.use(sessionMiddleware);
app.use(cookieParser());

//DATOS PARA CREAR LA CONEXION CON LA BASE DE DATOS
const config={
    "host": "localhost",
    "user": "root",
    "password": "",
    "base": "nodelogin"
}

//CREAR CONEXION CON LA BASE DE DATOS Y LA GUARDAMOS EN LA VARIABE db.
var db= mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'nodelogin'
});

//FUNCION QUE NOS DICE EL ESTADO DE NUESTRA CONEXION A LA BASE DE DATOS, EXITO O ERROR.
db.connect(function(err){
    if(!!err)
    throw err; //nos dice el error

    console.log('MySQL conectado: ' + config.host + ", usuario: " + config.user + ", Base de datos: " + config.base); //imprime que la conexion ha sido exitoSa, nos da el nombre del host, el usuario y la base de datos.
});

//USA LA RUTA ESTATICA /
app.use(express.static('./'));

//CREAMOS LA CONEXION DE LA SESION, NOS AVISA CUANDO UN USUARIO ENTRA AL CHAT.
io.on('connection', function (socket) {
    var req = socket.request; 
  
    console.log(req.session);
        //IF PARA SABER QUIEN INGRESA AL CHAT
      if(req.session.userID != null){
          db.query("SELECT * FROM users WHERE id=?", [req.session.userID], function(err, rows, fields){
              console.log('Sesión iniciada con el UserID: ' + req.session.userID + ' Y nombre de usuario: ' + req.session.username);
              socket.emit("logged_in", {user: req.session.username, email: req.session.correo});
          });//SI EL USUARIO INICIA SESION CORRECTAMENTE NOS NOTIFICA LOS DATOS DE QUIEN SE HA LOGEADO
      }else{
          console.log('No hay sesión iniciada'); //MUESTRA ESTE MENSAJE SI EL USUARIO NO HA INICIADO SESION
      }
      //FUNCION SOCKET PARA EL LOGIN 
      socket.on("login", function(data){
        const user = data.user,
        pass = data.pass;
        //CONSULTA PARA BUSCAR LOS DATOS DEL USUARIO QUE DESEA INGRESAR
        db.query("SELECT * FROM users WHERE username=?", [user], function(err, rows, fields){
            if(rows.length == 0){
                console.log("El usuario no existe, favor de registrarse!"); //CUANDO NO EXISTE EL USER EN LA BD
            }else{
                    console.log(rows);
                    
                    const dataUser = rows[0].username,
                    dataPass = rows[0].password,
                    dataCorreo = rows[0].email;
  
                  if(dataPass == null || dataUser == null){
                        socket.emit("error");//Si los datos no existen, arroja un error
                  }
                  if(user == dataUser && pass == dataPass){
                      console.log("Usuario correcto!");
                      socket.emit("logged_in", {user: user, email: dataCorreo}); //ENVIA user y email A LA FUNCION "logged_in" PARA CREAR LA SESION Y ENTRAR AL CHAT 
                      req.session.userID = rows[0].id;
                      req.session.username = dataUser;
                      req.session.correo = dataCorreo;
                      req.session.save(); //GUARDA LA SESION
                  }else{
                        socket.emit("invalido"); //CUANDO LOS DATOS SON INCORRECTOS
                  }
            }
        });
      });
      //FUNCION PARA CREAR UN USUARIO
      socket.on('addUser', function(data){
          const user = data.user,
          pass = data.pass,
          email = data.email;
          
          if(user != "" && pass != "" && email != ""){
              console.log("Registrando el usuario: " + user);
              //CONSULTA PARA INSERTAR EL USUARIO
                db.query("INSERT INTO users(`username`, `password`, `email`) VALUES(?, ?, ?)", [user, pass, email], function(err, result){
                if(!!err)
                throw err;//NOS DICE SI HAY UN ERROR
  
                console.log(result);//IMPRIME RESULTADO DE LA CONSULTA
  
                console.log('Usuario ' + user + " se dio de alta correctamente!."); 
                socket.emit('UsuarioOK');//NOS AVISA QUE EL USUARIO SE AGREGÓ
              });
          }else{
              socket.emit('vacio'); //NOS DICE QUE UNO DE LOS CAMPOS ESTA VACIO
          }
      });
      
      socket.on('mjsNuevo', function(data){ // FUNCION PARA CREAR CADA MENSAJE NUEVO
          
          const sala = 0; // ID DE LA SALA
          //CONSULTA PARA INSERTAR EL MENSAJE NUEVO A LA BD MENSAJES
              db.query("INSERT INTO mensajes(`mensaje`, `user_id`, `sala_id`, `fecha`) VALUES(?, ?, ?, CURDATE())", [data, req.session.userID, sala], function(err, result){
                if(!!err)
                throw err;//NOS NOTIFICA SI OCURRE UN ERROR.
  
                console.log(result);//IMPRIME RESULTADOS DE LA CONSULTA
  
                console.log('Mensaje dado de alta correctamente!.');
                    //FUNCION QUE ENVIA EL MENSAJE A TODOS LOS CHATS DE LOS USUARIOS PARA QUE TODOS PUEDAN VER EL MENSAJE NUEVO
                        socket.broadcast.emit('mensaje', {
                          usuario: req.session.username,
                          mensaje: data
                      });
                      
                      socket.emit('mensaje', {
                          usuario: req.session.username,
                          mensaje: data
                      });
              });
          
      });
      //FUNCION PARA DESTRUIR LA SESION
      socket.on('salir', function(request, response){
          req.session.destroy();
      });
  });