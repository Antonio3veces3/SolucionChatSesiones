//DECLARACION DE LIBRERIAS/DEPENDENCIAS/MODULOS QUE VAMOS A UTILIZAR
const express= require ('express'), 
socket= require('socket.io'),
mysql= require('mysql'),
cookieParser= require('cookie-parser'),
session= require('express-session');

//DECLARAMOS APP, VARIABLE DE LA APPLICACION QUE TRABAJARÁ LAS RUTAS Y EL PUERTO DE NUESTRO SERVIDOR.
var app= express();
const nameBot= 'BotChat';//BOTCHAT QUE MOSTRARA NOTIFICACIONES DE LOS EVENTOS DENTRO DEL CHAT
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
    //CONSUSTA PARA OBTENER LAS SALAS EXISTENTES Y EMITIRLAS CUANDO SE LLAME A 'showRooms'
    db.query("SELECT * FROM salas", function(err,rows,fields){
        const salas= rows; 
        console.log(salas);
        socket.emit('showRooms',salas);
    });
    console.log(req.session);
        //IF PARA SABER SI EL USUARIO YA INICIÓ SESIÓN
      if(req.session.userID != null){
          db.query("SELECT * FROM users WHERE id=?", [req.session.userID], function(err, rows, fields){
              console.log('Sesión iniciada con el UserID: ' + req.session.userID + ' Y nombre de usuario: ' + req.session.username);
              socket.emit("logged_in", {user: req.session.username, email: req.session.correo});
          });//SI EL USUARIO YA INICIÓ SESION CORRECTAMENTE NOS NOTIFICA LOS DATOS DE QUIEN SE HA LOGEADO
      }else{
          console.log('No hay sesión iniciada'); //MUESTRA ESTE MENSAJE SI EL USUARIO NO HA INICIADO SESION
      }
        

      //FUNCION SOCKET PARA EL LOGIN 
      socket.on("login", function(data){
        const username = data.username,
        password = data.password,
        sala= data.id_sala;
        //CONSULTA PARA BUSCAR LOS DATOS DEL USUARIO QUE DESEA LOGEARSE
        db.query("SELECT * FROM users WHERE username=?", [username], function(err, rows, fields){
            if(rows.length == 0){
                console.log("El usuario no existe, favor de registrarse!");
                socket.emit("sinRegistrar");
            }else{
                    console.log(rows);
                    //ALMACENAMOS LOS DATOS DEL USUARIO PARA AGREGARLOS A LA SESSION
                    const id= rows[0].id,
                    dataUser = rows[0].username,
                    dataPass = rows[0].password,
                    dataEmail = rows[0].email;
  
                  if(dataPass == null || dataUser == null){
                        socket.emit("error");//Si los datos no existen, arroja un error
                  }
                  if(username == dataUser && password == dataPass){
                      console.log("Usuario correcto!");
                      //CONSULTA PARA SABER SI LA SALA INGRESADA EXISTE 
                      db.query("SELECT * FROM salas WHERE id_sala=?", [sala], function(err,rows,fields){    
                          if(rows.length==0){
                              console.log("LA SALA NO EXISTE")
                              socket.emit("salaNull");
                          }else{
                            const nombreSala= rows[0].nombre_sala; 
                            //EMITE LA INFORMACION DEL USUARIO LOGEADO
                            socket.emit("logged_in", {username: dataUser, email: dataEmail, id_sala: sala, nombre_sala: nombreSala}); 
                            req.session.userID = id;
                            req.session.username = dataUser;
                            req.session.correo = dataEmail;
                            req.session.id_sala= sala;
                            req.session.nombre_sala= nombreSala;    
                            req.session.save(); //GUARDA LA SESION CON LOS DATOS DEL USUARIO
                            socket.join(req.session.nombre_sala); //INGRESA A LA SALA ELEGIDA
                            socket.emit('enviarHistorial'); //LLAMA A LA FUNCION PARA MOSTRAR HISTORIAL DE MENSAJES
                            Notificacion('LoginEnSala'); //NOTIFICACION EMITIDAS POR EL BOTCHAT
                            console.log(req.session);
                          }
                        })
                  }else{
                        socket.emit("invalido"); //CUANDO LOS DATOS SON INCORRECTOS
                  }
            }
        });
      });
      //FUNCION PARA CREAR UN USUARIO
      socket.on('addUser', function(data){
          //ALMACENAMOS LOS DATOS QUE INGRESÓ EL USUARIO
          const user = data.user,
          pass = data.pass,
          email = data.email;
          
          if(user != "" && pass != "" && email != ""){
              console.log("Registrando el usuario: " + user);
              //CONSULTA PARA SABER SI EL USERNAME O EMAIL YA EXISTEN EN OTROS USUARIOS
              db.query("SELECT * FROM users WHERE username=? OR email=?",[user,email], function(err,rows,fields){
                  if(rows.length>0){
                      socket.emit("UserExistente");
                  }else{
                      //SI NO EXISTE EL USERNAME O EMAIL, AGREGA AL USUARIO A LA DB
                    db.query("INSERT INTO users(`username`, `password`, `email`) VALUES(?, ?, ?)", [user, pass, email], function(err, result){
                        if(!!err)
                        throw err;//NOS DICE SI HAY UN ERROR
                        console.log(result);//IMPRIME RESULTADO DE LA CONSULTA
                        console.log('Usuario ' + user + " se dio de alta correctamente!."); 
                        socket.emit('UsuarioOK');//NOS AVISA QUE EL USUARIO SE AGREGÓ CORRECTAMENTE
                      });
                  }
              })
          }else{
              socket.emit('vacio'); //NOS DICE QUE UNO O MAS CAMPOS ESTAN VACIOS
          }
      });
      
      socket.on('mjsNuevo', function(data){ // FUNCION PARA CREAR CADA MENSAJE NUEVO
          
          var sala= req.session.id_sala; // ID DE LA SALA
          var user= req.session.userID; //ID DEL USUARIO
          //CONSULTA PARA INSERTAR EL MENSAJE NUEVO A LA BD MENSAJES CON SU SALA A LA QUE CORRESPONDE
              db.query("INSERT INTO mensajes(`mensaje`, `user_id`, `sala_id`, `fecha`) VALUES(?, ?, ?, CURDATE())", [data, user, sala], function(err, result){
                if(!!err)
                throw err;//NOS NOTIFICA SI OCURRE UN ERROR.
  
                console.log(result);
  
                console.log('Mensaje dado de alta correctamente!.');
                    //FUNCION QUE ENVIA EL MENSAJE UNICAMENTE A LA SALA DONDE CORRESPONDE
                        socket.broadcast.to(req.session.nombre_sala).emit('mensaje',{
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
        socket.leave(req.session.nombre_sala);
        req.session.destroy();
          
      });
      //FUNCION PARA CAMBIAR DE SALA
      socket.on('cambioDeSala', function(data){
        const salaId= data.id_sala,
        nombreSala= data.nombre_sala;

        socket.leave(req.session.nombre_sala); //CIERRA LA SESION DE LA SALA ACTUAL
        //GUARDAMOS LOS DATOS DE LA NUEVA SALA EN SESSION
        req.session.id_sala= salaId;
        req.session.nombre_sala= nombreSala;
        socket.join(req.session.nombre_sala); //INGRESAMOS A LA NUEVA SALA
        Notificacion('CambioDeSala'); //NOTIFICA EL BOTCHAT QUE SE HA CAMBIADO DE SALA
        console.log(req.session, 'Ha cambiado a la sala: '+req.session.nombre_sala);
      });
      //FUNCION PARA MOSTRAR EL HISTORIAL DE MENSAJES DE CADA SALA
      socket.on('historial',function(){
        console.log('Creando historial');
        //CONSULTA PARA EXTRAER LOS MENSAJES DE LA SALA
        db.query('SELECT nombre_sala as sala, username, mensaje FROM mensajes INNER JOIN salas ON id_sala=sala_id INNER JOIN users on id=user_id WHERE sala_id='+req.session.id_sala+' order by id_mensaje ASC', function(err,rows,fields){
            socket.emit('enviarHistorial', rows);
        });
      })
            
//FUNCION DE NOTIFICACIONES QUE ANUNCIA EL BOTCHAT
      function Notificacion(evento){
          const LoginEnSala= 'Bienvenido a la sala <b>'+req.session.nombre_sala+'</b>',
          CambioDeSala= 'Cambiaste a la sala <b>'+req.session.nombre_sala+'</b>';

          if(evento=="LoginEnSala"){
              socket.emit('notificacion',{
                  usuario: nameBot,
                  mensaje: LoginEnSala
              })
          }

          if(evento=="CambioDeSala"){
            socket.emit('notificacion',{
                usuario: nameBot,
                mensaje: CambioDeSala
                })
           }
      }
  });