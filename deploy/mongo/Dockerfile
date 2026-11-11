# MongoDB con lo script che crea l'utente applicativo già dentro l'immagine.
# Prima lo script arrivava con un bind mount relativo (./deploy/mongo/init), che gli stack Git di
# Portainer CE non montano: il database partiva senza l'utente e l'app non riusciva ad autenticarsi.
# Lo script gira solo alla prima creazione del volume dei dati, come prima.
FROM mongo:7
COPY init/ /docker-entrypoint-initdb.d/
