CREATE DATABASE IF NOT EXISTS `nodelogin` DEFAULT CHARACTER SET utf8 COLLATE utf8_general_ci; 
use nodelogin;

CREATE TABLE users(id int(11) auto_increment, 
username varchar(50) not null,
password varchar(255) not null,
email varchar(100) not null,
PRIMARY KEY (id));

CREATE TABLE mensajes(id_mensaje int(11) auto_increment,
mensaje text CHARACTER SET latin1 COLLATE latin1_swedish_ci NOT NULL,
user_id int not null,
sala_id int not null,
fecha timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
PRIMARY KEY (id_mensaje)); 

CREATE TABLE salas (id_sala int auto_increment,
nombre_sala varchar(30)  not null,
fecha_creacion date not null,
PRIMARY KEY (id_sala));

INSERT INTO salas (nombre_sala, fecha_creacion) VALUES ("Redes",current_date());
INSERT INTO salas (nombre_sala, fecha_creacion) VALUES ("Linux Kali",current_date());


SELECT nombre_sala as sala, username, mensaje FROM mensajes 
INNER JOIN salas ON id_sala=sala_id 
INNER JOIN users on id=user_id WHERE sala_id=4 order by id_mensaje ASC;