# Smart document project databases

This folder runs the local MariaDB and MongoDB services used by the Next.js app.
Docker Compose reads credentials from the ignored `.env` file; never commit that
file. Start with `.env.example`, choose private local passwords, and set the
same database name, user, password, and MongoDB credentials in the app's
root `.env.local`.

```powershell
Copy-Item .env.example .env
# Edit .env and root .env.local with matching local credentials.
docker compose up -d
docker compose ps
```

MariaDB is exposed on `127.0.0.1:3307`; MongoDB is exposed on
`127.0.0.1:27017`. The app creates its invoice metadata table automatically
when the API first connects. Stop the services with `docker compose down`;
persisted database volumes are retained.
