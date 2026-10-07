# Checklist Google Cloud Console — Google Drive Backup

Segui questi passi per ottenere le credenziali OAuth da inserire in `.env`.

## Setup iniziale

1. **Apri Google Cloud Console**
   Vai su https://console.cloud.google.com

2. **Crea o seleziona un progetto**
   Usa un progetto dedicato, per esempio `HomeTab Local`.

3. **Configura la schermata di consenso OAuth**
   Vai in *APIs & Services > OAuth consent screen*.
   Scegli **External** se vuoi usare account Google normali.
   Compila almeno:
   - App name: `HomeTab`
   - User support email: la tua email
   - Developer contact information: la tua email

4. **Aggiungi gli scope minimi**
   Nella schermata di consenso aggiungi:
   - `openid`
   - `email`
   - `profile`
   - `https://www.googleapis.com/auth/drive.file`

5. **Aggiungi utenti di test**
   Se l'app è in modalità *Testing*, aggiungi come **Test users** l'account Google che userai per collegare Drive.

6. **Abilita Google Drive API**
   Vai in *APIs & Services > Library*.
   Cerca **Google Drive API** e premi **Enable**.

## Creazione credenziali OAuth

7. **Crea le credenziali OAuth**
   Vai in *APIs & Services > Credentials*.
   Premi **Create Credentials > OAuth client ID**.
   Tipo applicazione: **Web application**.

8. **Configura gli Authorized redirect URIs**
   Inserisci esattamente:
   ```
   http://localhost:3000/api/integrations/google-drive/callback
   ```
   Per produzione aggiungi poi:
   ```
   https://tuo-dominio.it/api/integrations/google-drive/callback
   ```

9. **Configura gli Authorized JavaScript origins**
   In locale:
   ```
   http://localhost:3000
   ```
   Per produzione:
   ```
   https://tuo-dominio.it
   ```

10. **Salva e copia Client ID e Client Secret**
    Dopo la creazione troverai:
    - *OAuth 2.0 Client ID*
    - *Client secret*

## Aggiornamento .env

11. **Aggiorna `.env`**
    Sostituisci i valori placeholder:
    ```dotenv
    GOOGLE_OAUTH_CLIENT_ID=<incolla il Client ID>
    GOOGLE_OAUTH_CLIENT_SECRET=<incolla il Client Secret>
    GOOGLE_OAUTH_REDIRECT_URI=http://localhost:3000/api/integrations/google-drive/callback
    ```
    Lascia invariati `GOOGLE_DRIVE_TOKEN_SECRET` e `BACKUP_CRON_SECRET` (già generati).

12. **Riavvia l'app**
    Dopo aver cambiato le env, riavvia il server Next.js.

## Test del collegamento

13. **Prova il collegamento**
    - Vai in *Impostazioni*
    - Clicca **Collega Google Drive**
    - Accedi con l'account Google che hai messo tra i test users
    - Accetta i permessi richiesti

14. **Verifica il risultato atteso**
    - Stato **collegato** nella UI con email Google collegata
    - Pulsante **Backup ora** disponibile
    - Al primo backup, creazione cartella `HomeTab Backups` nel Drive

---

## Risoluzione problemi

| Errore | Causa | Soluzione |
|---|---|---|
| Redirect URI mismatch | URL nella Console ≠ valore in `.env` | Assicurati che coincidano esattamente (schema, host, porta, path) |
| Access blocked / app non verificata | Account non nei Test users | Aggiungi l'account in *OAuth consent screen > Test users* |
| Errore sul callback | `APP_URL` errato o server su porta diversa | Verifica `APP_URL=http://localhost:3000` e la porta attiva |
| Errore Drive API | API non abilitata nel progetto | Abilita *Google Drive API* in *APIs & Services > Library* |
| Nessun refresh token | App già autorizzata in precedenza senza `access_type=offline` | Revoca accesso da *Account Google > Sicurezza > Accesso di terze parti* e ripeti il collegamento |

---

## Valori finali in .env

```dotenv
APP_URL=http://localhost:3000
GOOGLE_OAUTH_REDIRECT_URI=http://localhost:3000/api/integrations/google-drive/callback
GOOGLE_OAUTH_CLIENT_ID=<valore reale>
GOOGLE_OAUTH_CLIENT_SECRET=<valore reale>
GOOGLE_DRIVE_TOKEN_SECRET=<già generato>
BACKUP_CRON_SECRET=<già generato>
```

## Cron schedulato (opzionale)

Per eseguire il backup automatico, chiama periodicamente:

```bash
curl -X POST http://localhost:3000/api/integrations/google-drive/run-scheduled \
  -H "Authorization: Bearer <valore di BACKUP_CRON_SECRET>"
```

Esempio con `crontab` (ogni notte alle 2:00):

```cron
0 2 * * * curl -s -X POST https://tuo-dominio.it/api/integrations/google-drive/run-scheduled -H "Authorization: Bearer <BACKUP_CRON_SECRET>"
```
